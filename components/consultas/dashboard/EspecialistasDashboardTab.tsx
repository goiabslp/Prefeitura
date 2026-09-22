import React, { useState, useEffect, useMemo } from 'react';
import { User, ConsultaEspecialista, ConsultaProcedimento } from '../../../types';
import * as db from '../../../services/consultasService';
import {
    Users,
    UserPlus,
    Search,
    Edit2,
    Trash2,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Loader2,
    X,
    Filter,
    Stethoscope,
    Briefcase,
    Sparkles,
    Activity,
    Layers,
    ShieldAlert,
    ChevronRight,
    RefreshCw
} from 'lucide-react';

interface EspecialistasDashboardTabProps {
    currentUser?: User | null;
}

const GRUPOS_SUGERIDOS = [
    'MÉDICOS',
    'PSICÓLOGOS',
    'FISIOTERAPEUTAS',
    'NUTRICIONISTAS',
    'DENTISTAS',
    'FONOAUDIÓLOGOS',
    'ENFERMEIROS',
    'ASSISTENTES SOCIAIS',
    'TERAPEUTAS OCUPACIONAIS'
];

const ESPECIALIDADES_SUGERIDAS = [
    'CARDIOLOGIA',
    'DERMATOLOGIA',
    'ORTOPEDIA',
    'GINECOLOGIA',
    'PEDIATRIA',
    'NEUROLOGIA',
    'OFTALMOLOGIA',
    'PSIQUIATRIA',
    'UROLOGIA',
    'ENDOCRINOLOGIA',
    'OTORRINOLARINGOLOGIA',
    'GASTROENTEROLOGIA',
    'CLÍNICA GERAL',
    'FISIOTERAPIA',
    'PSICOLOGIA CLÍNICA'
];

export const EspecialistasDashboardTab: React.FC<EspecialistasDashboardTabProps> = ({ currentUser }) => {
    const [especialistas, setEspecialistas] = useState<ConsultaEspecialista[]>([]);
    const [procedimentos, setProcedimentos] = useState<ConsultaProcedimento[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    // Filtros e busca
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedGrupo, setSelectedGrupo] = useState('TODOS');
    const [selectedStatus, setSelectedStatus] = useState<'TODOS' | 'Ativo' | 'Inativo'>('TODOS');

    // Modais
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEsp, setEditingEsp] = useState<ConsultaEspecialista | null>(null);
    const [nome, setNome] = useState('');
    const [especialidade, setEspecialidade] = useState('');
    const [grupo, setGrupo] = useState('MÉDICOS');
    const [status, setStatus] = useState<'Ativo' | 'Inativo'>('Ativo');
    const [formError, setFormError] = useState('');

    // Modal de confirmação de exclusão
    const [deleteModalEsp, setDeleteModalEsp] = useState<ConsultaEspecialista | null>(null);
    const [deleteError, setDeleteError] = useState('');

    // Feedback Toast
    const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

    const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
        setToast({ text, type });
        setTimeout(() => setToast(null), 3500);
    };

    // Carregar dados
    const loadData = async () => {
        setLoading(true);
        try {
            const [esps, procs] = await Promise.all([
                db.getEspecialistas(),
                db.getProcedimentos()
            ]);
            setEspecialistas(esps || []);
            setProcedimentos(procs || []);
        } catch (error) {
            console.error('Erro ao carregar especialistas:', error);
            showToast('Erro ao carregar lista de especialistas.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();

        const handleSync = () => {
            loadData();
        };

        window.addEventListener('consultas-especialistas-changed', handleSync);
        window.addEventListener('consultas-procedimentos-changed', handleSync);

        return () => {
            window.removeEventListener('consultas-especialistas-changed', handleSync);
            window.removeEventListener('consultas-procedimentos-changed', handleSync);
        };
    }, []);

    // Procedimentos por especialista (para contagem e validação)
    const procsByEspecialista = useMemo(() => {
        const map = new Map<string, ConsultaProcedimento[]>();
        procedimentos.forEach(p => {
            if (p.especialista_id) {
                const list = map.get(p.especialista_id) || [];
                list.push(p);
                map.set(p.especialista_id, list);
            }
        });
        return map;
    }, [procedimentos]);

    // Lista de grupos únicos
    const availableGrupos = useMemo(() => {
        const set = new Set<string>();
        especialistas.forEach(e => {
            if (e.grupo) set.add(e.grupo);
        });
        return Array.from(set).sort();
    }, [especialistas]);

    // Métricas
    const metrics = useMemo(() => {
        const total = especialistas.length;
        const ativos = especialistas.filter(e => e.status === 'Ativo').length;
        const inativos = total - ativos;
        const totalEspecialidades = new Set(especialistas.map(e => e.especialidade)).size;
        const totalVinculados = procedimentos.filter(p => !!p.especialista_id).length;
        return { total, ativos, inativos, totalEspecialidades, totalVinculados };
    }, [especialistas, procedimentos]);

    // Especialistas filtrados
    const filteredEspecialistas = useMemo(() => {
        return especialistas.filter(e => {
            const term = searchTerm.toLowerCase();
            const matchesSearch =
                e.nome.toLowerCase().includes(term) ||
                e.especialidade.toLowerCase().includes(term) ||
                (e.grupo && e.grupo.toLowerCase().includes(term));

            if (!matchesSearch) return false;

            if (selectedGrupo !== 'TODOS' && e.grupo !== selectedGrupo) return false;
            if (selectedStatus !== 'TODOS' && e.status !== selectedStatus) return false;

            return true;
        });
    }, [especialistas, searchTerm, selectedGrupo, selectedStatus]);

    // Abrir Modal de Cadastro / Edição
    const handleOpenModal = (esp: ConsultaEspecialista | null = null) => {
        setEditingEsp(esp);
        if (esp) {
            setNome(esp.nome);
            setEspecialidade(esp.especialidade);
            setGrupo(esp.grupo || 'MÉDICOS');
            setStatus(esp.status);
        } else {
            setNome('');
            setEspecialidade('');
            setGrupo('MÉDICOS');
            setStatus('Ativo');
        }
        setFormError('');
        setIsModalOpen(true);
    };

    // Salvar Especialista
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setFormError('');

        const cleanNome = nome.trim().toUpperCase();
        const cleanEsp = especialidade.trim().toUpperCase();
        const cleanGrupo = grupo.trim().toUpperCase() || 'MÉDICOS';

        if (!cleanNome) {
            setFormError('Nome do especialista é obrigatório.');
            return;
        }
        if (!cleanEsp) {
            setFormError('Especialidade é obrigatória.');
            return;
        }

        // Validação contra duplicação de especialista (mesmo nome e especialidade)
        const isDuplicate = especialistas.some(esp =>
            esp.nome.trim().toUpperCase() === cleanNome &&
            esp.especialidade.trim().toUpperCase() === cleanEsp &&
            (!editingEsp || esp.id !== editingEsp.id)
        );

        if (isDuplicate) {
            setFormError('Já existe um especialista cadastrado com este mesmo Nome e Especialidade.');
            return;
        }

        setActionLoading('save');
        try {
            if (editingEsp) {
                await db.updateEspecialista(editingEsp.id, {
                    nome: cleanNome,
                    especialidade: cleanEsp,
                    grupo: cleanGrupo,
                    status
                });
                showToast(`Especialista "${cleanNome}" atualizado com sucesso!`);
            } else {
                await db.createEspecialista({
                    nome: cleanNome,
                    especialidade: cleanEsp,
                    grupo: cleanGrupo,
                    status
                });
                showToast(`Especialista "${cleanNome}" cadastrado com sucesso!`);
            }
            setIsModalOpen(false);
            loadData();
        } catch (err: any) {
            setFormError(err.message || 'Erro ao salvar especialista.');
        } finally {
            setActionLoading(null);
        }
    };

    // Alternar status Ativo / Inativo
    const handleToggleStatus = async (esp: ConsultaEspecialista) => {
        const nextStatus: 'Ativo' | 'Inativo' = esp.status === 'Ativo' ? 'Inativo' : 'Ativo';
        setActionLoading(`toggle-${esp.id}`);
        try {
            await db.updateEspecialista(esp.id, { status: nextStatus });
            showToast(
                nextStatus === 'Ativo'
                    ? `Especialista "${esp.nome}" ativado com sucesso!`
                    : `Especialista "${esp.nome}" desativado.`,
                nextStatus === 'Ativo' ? 'success' : 'info'
            );
            loadData();
        } catch (err: any) {
            showToast(err.message || 'Erro ao alternar status do especialista.', 'error');
        } finally {
            setActionLoading(null);
        }
    };

    // Confirmar e Excluir Especialista
    const handleConfirmDelete = async () => {
        if (!deleteModalEsp) return;
        setDeleteError('');
        setActionLoading('delete');
        try {
            await db.deleteEspecialista(deleteModalEsp.id);
            showToast(`Especialista "${deleteModalEsp.nome}" excluído com sucesso!`);
            setDeleteModalEsp(null);
            loadData();
        } catch (err: any) {
            setDeleteError(err.message || 'Erro ao excluir especialista.');
        } finally {
            setActionLoading(null);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Toast Feedback */}
            {toast && (
                <div className={`fixed bottom-6 right-6 z-[1100] px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold transition-all animate-bounce ${
                    toast.type === 'error'
                        ? 'bg-rose-600 text-white'
                        : toast.type === 'info'
                        ? 'bg-slate-900 text-white'
                        : 'bg-emerald-600 text-white'
                }`}>
                    {toast.type === 'error' ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
                    <span>{toast.text}</span>
                </div>
            )}

            {/* Cabeçalho da Aba */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-wider">
                            Corpo Clínico & Especialidades
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-sky-50 border border-sky-100 text-sky-700 text-[10px] font-black uppercase tracking-wider">
                            {metrics.total} Cadastrado(s)
                        </span>
                    </div>
                    <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                        Gestão de Profissionais Especialistas
                    </h2>
                    <p className="text-xs text-slate-500 font-medium">
                        Cadastro de médicos, terapeutas e especialistas para vinculação direta nos procedimentos e agendamentos
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={loadData}
                        className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all cursor-pointer"
                        title="Recarregar Lista"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={() => handleOpenModal()}
                        className="px-4 py-2.5 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md shadow-sky-500/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                    >
                        <UserPlus className="w-4 h-4" />
                        <span>Adicionar Especialista</span>
                    </button>
                </div>
            </div>

            {/* Cards de Métricas */}
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total de Especialistas</span>
                    <div className="flex items-baseline justify-between mt-2">
                        <span className="text-2xl font-black text-slate-900">{metrics.total}</span>
                        <span className="text-[10px] font-bold text-slate-400">profissionais</span>
                    </div>
                </div>

                <div className="p-4 bg-emerald-50/60 rounded-2xl border border-emerald-200/70 shadow-xs flex flex-col justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Especialistas Ativos</span>
                    <div className="flex items-baseline justify-between mt-2">
                        <span className="text-2xl font-black text-emerald-800">{metrics.ativos}</span>
                        <span className="text-[10px] font-bold text-emerald-600">disponíveis</span>
                    </div>
                </div>

                <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-200/70 shadow-xs flex flex-col justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700">Especialidades Atendidas</span>
                    <div className="flex items-baseline justify-between mt-2">
                        <span className="text-2xl font-black text-indigo-800">{metrics.totalEspecialidades}</span>
                        <span className="text-[10px] font-bold text-indigo-600">ramos</span>
                    </div>
                </div>

                <div className="p-4 bg-sky-50/60 rounded-2xl border border-sky-200/70 shadow-xs flex flex-col justify-between">
                    <span className="text-[10px] font-black uppercase tracking-wider text-sky-700">Procedimentos Vinculados</span>
                    <div className="flex items-baseline justify-between mt-2">
                        <span className="text-2xl font-black text-sky-800">{metrics.totalVinculados}</span>
                        <span className="text-[10px] font-bold text-sky-600">com especialista</span>
                    </div>
                </div>
            </div>

            {/* Barra de Filtros & Busca */}
            <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Buscar por Nome, Especialidade ou Grupo..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* Filtro por Grupo */}
                    <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs font-bold text-slate-600">
                        <Briefcase className="w-3.5 h-3.5 text-slate-400 ml-1" />
                        <select
                            value={selectedGrupo}
                            onChange={(e) => setSelectedGrupo(e.target.value)}
                            className="bg-transparent border-none focus:outline-none pr-2 cursor-pointer font-bold text-slate-700 text-xs"
                        >
                            <option value="TODOS">Todos os Grupos</option>
                            {availableGrupos.map(g => (
                                <option key={g} value={g}>{g}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filtro por Status */}
                    <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200 text-xs font-bold text-slate-600">
                        <Filter className="w-3.5 h-3.5 text-slate-400 ml-1" />
                        <select
                            value={selectedStatus}
                            onChange={(e) => setSelectedStatus(e.target.value as any)}
                            className="bg-transparent border-none focus:outline-none pr-2 cursor-pointer font-bold text-slate-700 text-xs"
                        >
                            <option value="TODOS">Todos os Status</option>
                            <option value="Ativo">Apenas Ativos</option>
                            <option value="Inativo">Apenas Inativos</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Listagem de Especialistas */}
            {loading ? (
                <div className="py-16 text-center">
                    <Loader2 className="w-8 h-8 text-sky-600 animate-spin mx-auto mb-2" />
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Carregando especialistas...</p>
                </div>
            ) : filteredEspecialistas.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
                    {filteredEspecialistas.map(esp => {
                        const linkedProcs = procsByEspecialista.get(esp.id) || [];
                        const isAtivo = esp.status === 'Ativo';

                        return (
                            <div
                                key={esp.id}
                                className={`p-4 rounded-2xl border transition-all duration-200 bg-white flex flex-col justify-between gap-3 shadow-xs hover:shadow-md ${
                                    isAtivo ? 'border-slate-200/80 hover:border-sky-300' : 'border-slate-200 bg-slate-50/50 opacity-80'
                                }`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 shadow-xs ring-2 ${
                                            isAtivo
                                                ? 'bg-gradient-to-br from-indigo-500 to-sky-600 text-white ring-indigo-100'
                                                : 'bg-slate-200 text-slate-500 ring-slate-100'
                                        }`}>
                                            {esp.nome.slice(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight line-clamp-1">
                                                {esp.nome}
                                            </h4>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[9px] font-black uppercase tracking-wider border border-indigo-100">
                                                    {esp.especialidade}
                                                </span>
                                                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[9px] font-extrabold uppercase tracking-wider">
                                                    {esp.grupo || 'MÉDICO'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Status Badge */}
                                    <button
                                        onClick={() => handleToggleStatus(esp)}
                                        disabled={actionLoading === `toggle-${esp.id}`}
                                        className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1 border cursor-pointer transition-all ${
                                            isAtivo
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                                : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                                        }`}
                                        title="Clique para alternar o status deste especialista"
                                    >
                                        <span className={`w-1.5 h-1.5 rounded-full ${isAtivo ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                                        {isAtivo ? 'Ativo' : 'Inativo'}
                                    </button>
                                </div>

                                {/* Procedimentos Vinculados & Ações */}
                                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                                    <div className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                                        <Layers className="w-3 h-3 text-slate-400" />
                                        <span>{linkedProcs.length} procedimento(s) vinculado(s)</span>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => handleOpenModal(esp)}
                                            className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors cursor-pointer"
                                            title="Editar Especialista"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => {
                                                setDeleteModalEsp(esp);
                                                setDeleteError('');
                                            }}
                                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                            title="Excluir Especialista"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-slate-200 p-8 space-y-4">
                    <Users className="w-12 h-12 text-slate-300 mx-auto" />
                    <div className="space-y-1">
                        <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-wider">
                            Nenhum especialista encontrado
                        </h4>
                        <p className="text-xs text-slate-500 max-w-md mx-auto">
                            {searchTerm || selectedGrupo !== 'TODOS' || selectedStatus !== 'TODOS'
                                ? 'Tente ajustar os filtros ou termos da pesquisa.'
                                : 'Cadastre os profissionais especialistas para integrá-los aos procedimentos municipais.'}
                        </p>
                    </div>
                    <button
                        onClick={() => handleOpenModal()}
                        className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all inline-flex items-center gap-2 cursor-pointer"
                    >
                        <UserPlus className="w-4 h-4" />
                        <span>Cadastrar Primeiro Especialista</span>
                    </button>
                </div>
            )}

            {/* ======================================================= */}
            {/* MODAL: ADICIONAR / EDITAR ESPECIALISTA                   */}
            {/* ======================================================= */}
            {isModalOpen && (
                <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 flex flex-col scale-100">
                        {/* Header */}
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/70">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-sky-100 text-sky-600 flex items-center justify-center">
                                    <UserPlus className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                                        {editingEsp ? 'Editar Especialista' : 'Adicionar Especialista'}
                                    </h3>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        Corpo Clínico & Especialidades
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="p-1.5 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            {formError && (
                                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-semibold">
                                    <AlertTriangle className="w-4 h-4 shrink-0" />
                                    <span>{formError}</span>
                                </div>
                            )}

                            {/* Nome */}
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 ml-1">
                                    Nome do Profissional *
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: DR. JOÃO DA SILVA"
                                    value={nome}
                                    onChange={(e) => setNome(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all text-xs font-semibold uppercase"
                                    required
                                />
                            </div>

                            {/* Especialidade */}
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 ml-1">
                                    Especialidade *
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: DERMATOLOGIA, CARDIOLOGIA, ORTOPEDIA..."
                                    value={especialidade}
                                    onChange={(e) => setEspecialidade(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all text-xs font-semibold uppercase mb-1.5"
                                    required
                                />
                                {/* Sugestões rápidas de Especialidades */}
                                <div className="flex flex-wrap gap-1">
                                    {ESPECIALIDADES_SUGERIDAS.slice(0, 6).map(espItem => (
                                        <button
                                            type="button"
                                            key={espItem}
                                            onClick={() => setEspecialidade(espItem)}
                                            className={`px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase transition-all cursor-pointer ${
                                                especialidade.toUpperCase() === espItem
                                                    ? 'bg-indigo-600 text-white'
                                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                                            }`}
                                        >
                                            {espItem}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Grupo Profissional */}
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 ml-1">
                                    Grupo Profissional
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ex: MÉDICOS, FISIOTERAPEUTAS, PSICÓLOGOS..."
                                    value={grupo}
                                    onChange={(e) => setGrupo(e.target.value)}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all text-xs font-semibold uppercase mb-1.5"
                                />
                                {/* Sugestões rápidas de Grupo */}
                                <div className="flex flex-wrap gap-1">
                                    {GRUPOS_SUGERIDOS.slice(0, 5).map(gItem => (
                                        <button
                                            type="button"
                                            key={gItem}
                                            onClick={() => setGrupo(gItem)}
                                            className={`px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase transition-all cursor-pointer ${
                                                grupo.toUpperCase() === gItem
                                                    ? 'bg-sky-600 text-white'
                                                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                                            }`}
                                        >
                                            {gItem}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Status */}
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 ml-1">
                                    Status
                                </label>
                                <div className="flex gap-4 pt-1">
                                    {(['Ativo', 'Inativo'] as const).map(st => (
                                        <label key={st} className="flex items-center gap-1.5 cursor-pointer text-xs font-bold text-slate-700">
                                            <input
                                                type="radio"
                                                name="espStatus"
                                                value={st}
                                                checked={status === st}
                                                onChange={() => setStatus(st)}
                                                className="w-4 h-4 text-sky-600 border-slate-300 focus:ring-sky-500"
                                            />
                                            <span>{st === 'Ativo' ? 'Ativo (Disponível para seleção)' : 'Inativo'}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Botões */}
                            <div className="pt-4 border-t border-slate-100 flex justify-end gap-3 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-extrabold rounded-xl text-xs uppercase tracking-wider cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionLoading === 'save'}
                                    className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-extrabold rounded-xl shadow-md active:scale-95 transition-all text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                                >
                                    {actionLoading === 'save' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                    <span>{editingEsp ? 'Atualizar' : 'Salvar Especialista'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ======================================================= */}
            {/* MODAL: CONFIRMAR EXCLUSÃO                                */}
            {/* ======================================================= */}
            {deleteModalEsp && (
                <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 p-6 space-y-4">
                        <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
                            <Trash2 className="w-6 h-6" />
                        </div>

                        <div className="text-center space-y-1">
                            <h3 className="text-base font-black text-slate-900 uppercase">
                                Excluir Especialista?
                            </h3>
                            <p className="text-xs text-slate-500 font-medium">
                                Tem certeza que deseja excluir permanentemente o especialista{' '}
                                <strong className="text-slate-800">{deleteModalEsp.nome}</strong>?
                            </p>
                        </div>

                        {deleteError && (
                            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-rose-700 text-xs font-semibold">
                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                <span>{deleteError}</span>
                            </div>
                        )}

                        <div className="pt-2 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setDeleteModalEsp(null)}
                                className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-extrabold rounded-xl text-xs uppercase tracking-wider cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDelete}
                                disabled={actionLoading === 'delete'}
                                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-xl shadow-md active:scale-95 transition-all text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer"
                            >
                                {actionLoading === 'delete' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                <span>Confirmar Exclusão</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
