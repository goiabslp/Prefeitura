import React, { useState, useMemo, useEffect } from 'react';
import { User, ConsultaPaciente } from '../../types';
import { 
    useAgentesSaude, 
    addAgenteSaude, 
    updateAgenteSaude, 
    deleteAgenteSaude, 
    resetAgentesSaudePadrao,
    AgenteSaudeItem
} from '../../services/agentesSaudeService';
import { 
    Search, Plus, Edit2, Trash2, Users, UserCheck, 
    RotateCcw, Check, X, Loader2, AlertTriangle, ShieldCheck,
    Building2, MapPin, Filter, Sparkles, ChevronDown, CheckCircle2
} from 'lucide-react';

interface AgentesSaudeTabProps {
    currentUser: User;
    pacientes?: ConsultaPaciente[];
    onRefreshPacientes?: () => void;
}

export const OPCOES_PSF = [
    'PSF 1 - Maria Ferreira da Sailva',
    'PSF 2 - Carmelino Moraes'
];

export const AgentesSaudeHeaderMetrics: React.FC<{
    pacientes?: ConsultaPaciente[];
}> = ({ pacientes: propPacientes }) => {
    const { items: agentesItems } = useAgentesSaude();
    const [localPacientes, setLocalPacientes] = useState<ConsultaPaciente[]>(propPacientes || []);

    useEffect(() => {
        if (propPacientes && propPacientes.length > 0) {
            setLocalPacientes(propPacientes);
        } else {
            import('../../services/consultasService').then(db => {
                db.getPacientes().then(data => {
                    if (data && Array.isArray(data)) setLocalPacientes(data);
                }).catch(console.error);
            });
        }
    }, [propPacientes]);

    const pacientes = propPacientes && propPacientes.length > 0 ? propPacientes : localPacientes;

    const totalAgentes = agentesItems.length;
    const totalComPsf = agentesItems.filter(a => a.psf && a.psf.trim().length > 0).length;
    const totalPacientesComAgente = pacientes.filter(p => p.agente_saude && p.agente_saude.trim().length > 0).length;
    const percentPsf = totalAgentes > 0 ? Math.round((totalComPsf / totalAgentes) * 100) : 0;

    return (
        <div className="flex items-center gap-2 flex-wrap justify-end animate-in fade-in duration-300">
            {/* 1. Total Agentes */}
            <div className="flex items-center gap-2 px-2.5 py-1 bg-white border border-slate-200/90 rounded-xl shadow-2xs">
                <div className="w-5 h-5 rounded-md bg-teal-50 border border-teal-100 text-teal-600 flex items-center justify-center shrink-0">
                    <UserCheck className="w-3 h-3" />
                </div>
                <div className="flex flex-col leading-none">
                    <span className="text-[7.5px] font-black uppercase tracking-wider text-slate-400">Total Agentes</span>
                    <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-xs font-black text-slate-800">{totalAgentes}</span>
                        <span className="text-[7.5px] font-bold text-teal-700 bg-teal-50 px-1 py-0.2 rounded uppercase">Ativos</span>
                    </div>
                </div>
            </div>

            {/* 2. Alocados em PSF */}
            <div className="flex items-center gap-2 px-2.5 py-1 bg-white border border-slate-200/90 rounded-xl shadow-2xs">
                <div className="w-5 h-5 rounded-md bg-sky-50 border border-sky-100 text-sky-600 flex items-center justify-center shrink-0">
                    <Building2 className="w-3 h-3" />
                </div>
                <div className="flex flex-col leading-none">
                    <span className="text-[7.5px] font-black uppercase tracking-wider text-slate-400">Alocados em PSF</span>
                    <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-xs font-black text-slate-800">{totalComPsf}<span className="text-[8.5px] font-semibold text-slate-400">/{totalAgentes}</span></span>
                        <span className="text-[7.5px] font-bold text-sky-700 bg-sky-50 px-1 py-0.2 rounded uppercase">{percentPsf}%</span>
                    </div>
                </div>
            </div>

            {/* 3. Pacientes Vinculados */}
            <div className="flex items-center gap-2 px-2.5 py-1 bg-white border border-slate-200/90 rounded-xl shadow-2xs">
                <div className="w-5 h-5 rounded-md bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                    <Users className="w-3 h-3" />
                </div>
                <div className="flex flex-col leading-none">
                    <span className="text-[7.5px] font-black uppercase tracking-wider text-slate-400">Pacientes Vinculados</span>
                    <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-xs font-black text-slate-800">{totalPacientesComAgente}</span>
                        <span className="text-[7.5px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded uppercase">Cadastros</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const AgentesSaudeTab: React.FC<AgentesSaudeTabProps> = ({
    currentUser,
    pacientes: propPacientes,
    onRefreshPacientes
}) => {
    const isAdmin = currentUser.role === 'admin';
    const { items: agentesItems } = useAgentesSaude();
    const [localPacientes, setLocalPacientes] = useState<ConsultaPaciente[]>(propPacientes || []);

    useEffect(() => {
        if (propPacientes && propPacientes.length > 0) {
            setLocalPacientes(propPacientes);
        } else {
            import('../../services/consultasService').then(db => {
                db.getPacientes().then(data => {
                    if (data && Array.isArray(data)) setLocalPacientes(data);
                }).catch(console.error);
            });
        }
    }, [propPacientes]);

    const pacientes = propPacientes && propPacientes.length > 0 ? propPacientes : localPacientes;

    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPsfFilter, setSelectedPsfFilter] = useState<string>('all');
    const [actionLoading, setActionLoading] = useState(false);
    const [notification, setNotification] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    // Modal de Novo / Edição
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAgent, setEditingAgent] = useState<AgenteSaudeItem | null>(null);
    const [formName, setFormName] = useState('');
    const [formPsf, setFormPsf] = useState('');
    const [formError, setFormError] = useState('');

    // Modal de Exclusão
    const [deletingAgent, setDeletingAgent] = useState<AgenteSaudeItem | null>(null);

    const showNotify = (msg: string, type: 'success' | 'error' = 'success') => {
        setNotification({ msg, type });
        setTimeout(() => setNotification(null), 3500);
    };

    // Mapeamento de contagem de pacientes por agente
    const patientCountByAgente = useMemo(() => {
        const map: Record<string, number> = {};
        pacientes.forEach(p => {
            if (p.agente_saude) {
                const normalized = p.agente_saude.trim().toUpperCase();
                map[normalized] = (map[normalized] || 0) + 1;
            }
        });
        return map;
    }, [pacientes]);

    // Lista única de PSFs cadastrados para o filtro
    const availablePsfs = useMemo(() => {
        const set = new Set<string>();
        agentesItems.forEach(a => {
            if (a.psf && a.psf.trim()) set.add(a.psf.trim().toUpperCase());
        });
        return Array.from(set).sort();
    }, [agentesItems]);

    // Métricas compactas
    const totalAgentes = agentesItems.length;
    const totalComPsf = agentesItems.filter(a => a.psf && a.psf.trim().length > 0).length;

    // Filtro unificado (texto e PSF)
    const filteredAgentes = useMemo(() => {
        return agentesItems.filter(item => {
            const matchesText = !searchTerm.trim() || 
                item.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (item.psf && item.psf.toLowerCase().includes(searchTerm.toLowerCase()));

            if (!matchesText) return false;

            if (selectedPsfFilter === 'all') return true;
            if (selectedPsfFilter === 'sem_psf') return !item.psf || !item.psf.trim();
            if (selectedPsfFilter === 'com_psf') return !!(item.psf && item.psf.trim());
            return (item.psf || '').toUpperCase() === selectedPsfFilter.toUpperCase();
        });
    }, [agentesItems, searchTerm, selectedPsfFilter]);

    // Abrir Modal de Adicionar
    const handleOpenAdd = () => {
        setEditingAgent(null);
        setFormName('');
        setFormPsf('');
        setFormError('');
        setIsModalOpen(true);
    };

    // Abrir Modal de Edição
    const handleOpenEdit = (item: AgenteSaudeItem) => {
        setEditingAgent(item);
        setFormName(item.nome);
        setFormPsf(item.psf || '');
        setFormError('');
        setIsModalOpen(true);
    };

    // Salvar (Adicionar ou Editar)
    const handleSaveAgent = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanName = formName.trim().toUpperCase();
        const cleanPsf = formPsf.trim().toUpperCase();

        if (!cleanName) {
            setFormError('Por favor, informe o nome do agente.');
            return;
        }

        setActionLoading(true);
        setFormError('');

        try {
            if (editingAgent) {
                const res = await updateAgenteSaude(editingAgent.nome, cleanName, cleanPsf);
                if (!res.success) {
                    setFormError(res.error || 'Erro ao atualizar agente de saúde.');
                    setActionLoading(false);
                    return;
                }
                showNotify(`Agente "${cleanName}" atualizado com sucesso!`);
                if (onRefreshPacientes) onRefreshPacientes();
            } else {
                const res = await addAgenteSaude(cleanName, cleanPsf);
                if (!res.success) {
                    setFormError(res.error || 'Erro ao adicionar agente de saúde.');
                    setActionLoading(false);
                    return;
                }
                showNotify(`Agente "${cleanName}" adicionado com sucesso!`);
            }

            setIsModalOpen(false);
        } catch (err: any) {
            console.error('Erro ao salvar agente:', err);
            setFormError(err.message || 'Erro inesperado.');
        } finally {
            setActionLoading(false);
        }
    };

    // Confirmar Exclusão
    const handleConfirmDelete = async () => {
        if (!deletingAgent) return;
        setActionLoading(true);
        try {
            const res = await deleteAgenteSaude(deletingAgent.nome);
            if (res.success) {
                showNotify(`Agente "${deletingAgent.nome}" removido com sucesso.`);
            } else {
                showNotify(res.error || 'Erro ao remover agente.', 'error');
            }
            setDeletingAgent(null);
        } catch (err: any) {
            showNotify('Erro ao remover agente.', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    // Restaurar Padrão Oficial
    const handleResetPadrao = async () => {
        if (!window.confirm('Deseja restaurar a lista padrão oficial com os 15 agentes de saúde do município? Novos agentes personalizados serão substituídos.')) {
            return;
        }
        setActionLoading(true);
        try {
            await resetAgentesSaudePadrao();
            showNotify('Lista padrão restaurada com sucesso!');
        } catch (err) {
            showNotify('Erro ao restaurar lista padrão.', 'error');
        } finally {
            setActionLoading(false);
        }
    };

    return (
        <div className="space-y-3.5 animate-in fade-in duration-300">
            {/* Notificação Flutuante */}
            {notification && (
                <div className={`fixed top-5 right-5 z-[9999] px-4 py-2.5 rounded-xl shadow-xl border flex items-center gap-2.5 text-xs font-black animate-slide-up ${
                    notification.type === 'success' 
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-600/20' 
                    : 'bg-rose-600 text-white border-rose-500 shadow-rose-600/20'
                }`}>
                    {notification.type === 'success' ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    <span>{notification.msg}</span>
                </div>
            )}

            {/* Barra de Ações & Filtros Compacta */}
            <div className="bg-white border border-slate-200/80 rounded-2xl p-3 shadow-xs flex flex-col md:flex-row items-center justify-between gap-2.5">
                <div className="flex flex-1 flex-wrap items-center gap-2 w-full md:w-auto">
                    {/* Campo de Busca Compacto */}
                    <div className="relative flex-1 sm:w-72 min-w-[200px]">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar por agente ou PSF..."
                            className="w-full pl-9 pr-8 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 text-slate-800 transition-all placeholder:text-slate-400"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* Filtro por PSF */}
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
                        <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <select
                            value={selectedPsfFilter}
                            onChange={(e) => setSelectedPsfFilter(e.target.value)}
                            className="text-xs font-bold text-slate-700 bg-transparent outline-none cursor-pointer pr-1"
                        >
                            <option value="all">Todos os PSFs ({totalAgentes})</option>
                            <option value="com_psf">Apenas com PSF ({totalComPsf})</option>
                            <option value="sem_psf">Sem PSF ({totalAgentes - totalComPsf})</option>
                            {availablePsfs.map(psf => (
                                <option key={psf} value={psf}>{psf}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Botões de Ação Direita */}
                <div className="flex items-center gap-2 shrink-0 w-full md:w-auto justify-end">
                    <button
                        type="button"
                        onClick={handleResetPadrao}
                        disabled={actionLoading}
                        title="Restaurar a lista oficial inicial de agentes de saúde"
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-600 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Restaurar Padrão</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleOpenAdd}
                        disabled={actionLoading}
                        className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 active:bg-teal-800 text-white rounded-xl font-extrabold text-xs uppercase tracking-wider shadow-sm shadow-teal-600/20 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Novo Agente</span>
                    </button>
                </div>
            </div>

            {/* Listagem em Tabela Compacta */}
            <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                <th className="py-2.5 px-4 w-12 text-center">#</th>
                                <th className="py-2.5 px-4">Nome do Agente de Saúde</th>
                                <th className="py-2.5 px-4">PSF / Unidade Alocada</th>
                                <th className="py-2.5 px-4 text-center">Pacientes Atendidos</th>
                                <th className="py-2.5 px-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                            {filteredAgentes.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-10 text-center text-slate-400">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <UserCheck className="w-8 h-8 text-slate-300" />
                                            <span className="font-bold text-xs">Nenhum agente de saúde encontrado.</span>
                                            {searchTerm && (
                                                <button
                                                    onClick={() => { setSearchTerm(''); setSelectedPsfFilter('all'); }}
                                                    className="text-teal-600 font-extrabold text-[11px] underline hover:text-teal-800"
                                                >
                                                    Limpar filtros de busca
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredAgentes.map((item, index) => {
                                    const count = patientCountByAgente[item.nome.toUpperCase()] || 0;
                                    const initials = item.nome
                                        .split(' ')
                                        .filter(Boolean)
                                        .slice(0, 2)
                                        .map(n => n[0])
                                        .join('')
                                        .toUpperCase() || 'AG';

                                    const hasPsf = !!(item.psf && item.psf.trim());

                                    return (
                                        <tr 
                                            key={item.nome} 
                                            className="hover:bg-teal-50/20 transition-colors group"
                                        >
                                            {/* Índice */}
                                            <td className="py-2.5 px-4 text-center text-[11px] font-bold text-slate-400">
                                                {String(index + 1).padStart(2, '0')}
                                            </td>

                                            {/* Nome com Avatar Compacto */}
                                            <td className="py-2.5 px-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-7 h-7 rounded-lg bg-teal-50 border border-teal-200/70 text-teal-700 font-black text-[10px] flex items-center justify-center shrink-0">
                                                        {initials}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <span className="font-extrabold text-slate-800 uppercase tracking-tight block truncate">
                                                            {item.nome}
                                                        </span>
                                                        <span className="text-[9px] font-bold text-slate-400 uppercase">
                                                            Agente Comunitário de Saúde (ACS)
                                                        </span>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* PSF / Unidade Alocada */}
                                            <td className="py-2.5 px-4">
                                                {hasPsf ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-sky-50 border border-sky-100 text-sky-700 font-black text-[10px] uppercase tracking-wider">
                                                        <Building2 className="w-3 h-3 text-sky-600 shrink-0" />
                                                        {item.psf}
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-400 font-bold text-[10px] uppercase">
                                                        Não alocado
                                                    </span>
                                                )}
                                            </td>

                                            {/* Pacientes Atendidos */}
                                            <td className="py-2.5 px-4 text-center">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black ${
                                                    count > 0 
                                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60' 
                                                    : 'bg-slate-100 text-slate-400'
                                                }`}>
                                                    <Users className="w-3 h-3" />
                                                    {count} {count === 1 ? 'paciente' : 'pacientes'}
                                                </span>
                                            </td>

                                            {/* Ações Compactas */}
                                            <td className="py-2.5 px-4 text-right">
                                                <div className="inline-flex items-center gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenEdit(item)}
                                                        title="Editar agente e PSF"
                                                        className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer"
                                                    >
                                                        <Edit2 className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setDeletingAgent(item)}
                                                        title="Excluir agente"
                                                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Rodapé Compacto da Tabela */}
                <div className="px-4 py-2 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-400">
                    <span>Exibindo {filteredAgentes.length} de {totalAgentes} agentes</span>
                    <span className="text-teal-700 font-extrabold uppercase">São José do Goiabal - MG</span>
                </div>
            </div>

            {/* MODAL: ADICIONAR / EDITAR AGENTE */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 flex flex-col animate-slide-up">
                        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
                                    <UserCheck className="w-4 h-4" />
                                </div>
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">
                                    {editingAgent ? 'Editar Agente de Saúde' : 'Novo Agente de Saúde'}
                                </h3>
                            </div>
                            <button 
                                onClick={() => setIsModalOpen(false)} 
                                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveAgent} className="p-5 space-y-4">
                            {formError && (
                                <div className="p-2.5 bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold rounded-xl flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                                    <span>{formError}</span>
                                </div>
                            )}

                            {/* Campo: Nome */}
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                                    Nome Completo do Agente *
                                </label>
                                <input
                                    type="text"
                                    required
                                    autoFocus
                                    placeholder="EX: MARIA DA SILVA"
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value.toUpperCase())}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 font-bold uppercase focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10 outline-none transition-all"
                                />
                            </div>

                            {/* Campo: PSF / Unidade Alocada (Select Dinâmico, Moderno e Bonito) */}
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 flex items-center justify-between">
                                    <span className="flex items-center gap-1.5">
                                        <Building2 className="w-3.5 h-3.5 text-teal-600" />
                                        PSF / Unidade de Saúde Alocada
                                    </span>
                                    <span className="text-slate-400 text-[9px] font-semibold">(Opcional)</span>
                                </label>

                                <div className="space-y-2">
                                    {/* Select estilizado de alta qualidade */}
                                    <div className="relative">
                                        <select
                                            value={formPsf}
                                            onChange={(e) => setFormPsf(e.target.value)}
                                            className={`w-full appearance-none pl-9 pr-9 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-2xs outline-none ${
                                                formPsf 
                                                ? 'bg-sky-50/70 border-sky-300 text-sky-900 ring-2 ring-sky-500/10' 
                                                : 'bg-slate-50 border-slate-200 text-slate-500 focus:bg-white focus:border-teal-500 focus:ring-2 focus:ring-teal-500/10'
                                            }`}
                                        >
                                            <option value="">-- SELECIONE O PSF (NÃO ALOCADO) --</option>
                                            {OPCOES_PSF.map((psf) => (
                                                <option key={psf} value={psf}>
                                                    {psf}
                                                </option>
                                            ))}
                                        </select>
                                        <Building2 className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${formPsf ? 'text-sky-600' : 'text-slate-400'}`} />
                                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    </div>

                                    {/* Cards de Seleção Rápida Dinâmicos, Modernos e Interativos */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-0.5">
                                        {OPCOES_PSF.map((psf, idx) => {
                                            const isSelected = formPsf.trim().toLowerCase() === psf.trim().toLowerCase();
                                            return (
                                                <button
                                                    key={psf}
                                                    type="button"
                                                    onClick={() => setFormPsf(isSelected ? '' : psf)}
                                                    className={`p-2.5 rounded-xl border text-left flex items-center justify-between gap-2 transition-all cursor-pointer active:scale-98 ${
                                                        isSelected
                                                        ? 'bg-gradient-to-r from-sky-500 to-sky-600 text-white border-sky-600 shadow-sm shadow-sky-500/20 ring-2 ring-sky-400/30'
                                                        : 'bg-slate-50 hover:bg-sky-50/50 border-slate-200 text-slate-700 hover:border-sky-200'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                                                            isSelected ? 'bg-white/20 text-white' : 'bg-white border border-slate-200 text-sky-600'
                                                        }`}>
                                                            <Building2 className="w-3.5 h-3.5" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <span className={`text-[8.5px] font-black uppercase tracking-wider block ${isSelected ? 'text-sky-100' : 'text-slate-400'}`}>
                                                                Unidade 0{idx + 1}
                                                            </span>
                                                            <span className="text-[10.5px] font-extrabold truncate block">
                                                                {psf}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {isSelected ? (
                                                        <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                                                    ) : (
                                                        <div className="w-4 h-4 rounded-full border border-slate-300 shrink-0" />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {formPsf && (
                                        <div className="flex justify-end pt-0.5">
                                            <button
                                                type="button"
                                                onClick={() => setFormPsf('')}
                                                className="text-[10px] font-bold text-slate-400 hover:text-rose-600 transition-colors flex items-center gap-1 cursor-pointer"
                                            >
                                                <X className="w-3 h-3" /> Desvincular / Deixar Sem PSF
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Botões do Modal */}
                            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-3.5 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionLoading}
                                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-sm shadow-teal-600/20 transition-all cursor-pointer inline-flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                                >
                                    {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                    {editingAgent ? 'Salvar Alterações' : 'Cadastrar Agente'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: CONFIRMAÇÃO DE EXCLUSÃO */}
            {deletingAgent && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-100 p-5 space-y-4 animate-slide-up">
                        <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
                            <Trash2 className="w-5 h-5" />
                        </div>
                        <div className="text-center space-y-1">
                            <h4 className="font-extrabold text-slate-900 text-sm uppercase">Remover Agente de Saúde?</h4>
                            <p className="text-xs text-slate-500">
                                Deseja realmente remover <strong className="text-slate-800">{deletingAgent.nome}</strong>?
                            </p>
                            {deletingAgent.psf && (
                                <span className="inline-block text-[10px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-100 uppercase mt-1">
                                    Alocado em: {deletingAgent.psf}
                                </span>
                            )}
                            <p className="text-[11px] text-slate-400 mt-2">
                                Ele deixará de aparecer no select de novos cadastros de pacientes.
                            </p>
                        </div>
                        <div className="flex items-center gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setDeletingAgent(null)}
                                className="flex-1 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDelete}
                                disabled={actionLoading}
                                className="flex-1 py-2 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 rounded-xl uppercase tracking-wider transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                            >
                                {actionLoading ? 'Removendo...' : 'Sim, Remover'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
