import React, { useState, useEffect, useMemo } from 'react';
import { User, FarmaciaMedicamento, FarmaciaMovimentacao } from '../../types';
import { Package, Plus, Edit, Trash2, Calendar, AlertTriangle, ChevronRight, CheckCircle2, TrendingUp, Info, Loader2, Sparkles, SlidersHorizontal, X, XCircle, Search } from 'lucide-react';
import * as db from '../../services/farmaciaService';

interface EstoqueScreenProps {
    currentUser: User;
    onBack: () => void;
    appState: any;
}

export const EstoqueScreen: React.FC<EstoqueScreenProps> = ({
    currentUser,
    onBack
}) => {
    // DB state
    const [medicamentos, setMedicamentos] = useState<FarmaciaMedicamento[]>([]);
    const [movimentacoes, setMovimentacoes] = useState<FarmaciaMovimentacao[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modal control
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
    const [selectedMed, setSelectedMed] = useState<FarmaciaMedicamento | null>(null);

    // Custom select dropdown states
    const [isAddCatOpen, setIsAddCatOpen] = useState(false);
    const [isAddTipoOpen, setIsAddTipoOpen] = useState(false);
    const [isEditCatOpen, setIsEditCatOpen] = useState(false);
    const [isEditTipoOpen, setIsEditTipoOpen] = useState(false);

    // Form inputs
    const [nome, setNome] = useState('');
    const [categoria, setCategoria] = useState<'CBAF' | 'CESAF' | 'CEAF'>('CBAF');
    const [quantidade, setQuantidade] = useState('');
    const [unidade, setUnidade] = useState('Unidade');
    const [validade, setValidade] = useState('');
    const [lote, setLote] = useState('');
    const [limiteMinimo, setLimiteMinimo] = useState('10');
    const [fornecedor, setFornecedor] = useState('');
    const [tipo, setTipo] = useState('Comprimido');
    const [dosagem, setDosagem] = useState('');
    const [saving, setSaving] = useState(false);

    // Adjustment form inputs
    const [adjustQty, setAdjustQty] = useState('');
    const [adjustType, setAdjustType] = useState<'Entrada' | 'Ajuste'>('Entrada');
    const [adjustReason, setAdjustReason] = useState('');

    // Permissions
    const isAdmin = currentUser.role === 'admin';
    const canCreate = currentUser.permissions?.includes('parent_farmacia_criar') || isAdmin;
    const canEdit = currentUser.permissions?.includes('parent_farmacia_editar') || isAdmin;
    const canDelete = currentUser.permissions?.includes('parent_farmacia_excluir') || isAdmin;
    const canApprove = currentUser.permissions?.includes('parent_farmacia_aprovar') || isAdmin;

    const loadData = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const [medData, movData] = await Promise.all([
                db.getMedicamentos(),
                db.getMovimentacoes()
            ]);
            setMedicamentos(medData);
            setMovimentacoes(movData);
        } catch (error) {
            console.error('[EstoqueScreen] Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();

        const handleMedChange = () => loadData(true);
        const handleMovChange = () => loadData(true);

        window.addEventListener('farmacia-medicamentos-changed', handleMedChange);
        window.addEventListener('farmacia-movimentacoes-changed', handleMovChange);

        return () => {
            window.removeEventListener('farmacia-medicamentos-changed', handleMedChange);
            window.removeEventListener('farmacia-movimentacoes-changed', handleMovChange);
        };
    }, []);

    // --- ANALYTICS DASHBOARD COMPUTATIONS ---
    const stats = useMemo(() => {
        const totalItems = medicamentos.length;
        const totalQty = medicamentos.reduce((acc, m) => acc + m.quantidade, 0);
        const outOfStock = medicamentos.filter(m => m.quantidade === 0).length;
        
        // Expiration in next 90 days
        const nearExpiration = medicamentos.filter(m => {
            const daysLeft = (new Date(m.validade).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
            return daysLeft > 0 && daysLeft <= 90;
        }).length;

        // Most Withdrawn drugs ranking (type 'Saída')
        const withdrawals = movimentacoes.filter(m => m.tipo === 'Saída');
        const grouped: Record<string, number> = {};
        withdrawals.forEach(w => {
            grouped[w.medicamento_nome] = (grouped[w.medicamento_nome] || 0) + w.quantidade;
        });

        const sortedRanking = Object.entries(grouped)
            .map(([name, qty]) => ({ name, qty }))
            .sort((a, b) => b.qty - a.qty)
            .slice(0, 5);

        return {
            totalItems,
            totalQty,
            outOfStock,
            nearExpiration,
            sortedRanking
        };
    }, [medicamentos, movimentacoes]);

    // Filtered list for search
    const filteredMedicamentos = useMemo(() => {
        if (!searchTerm.trim()) return medicamentos;
        const term = searchTerm.toLowerCase();
        return medicamentos.filter(med => 
            med.nome.toLowerCase().includes(term) ||
            med.lote.toLowerCase().includes(term) ||
            med.categoria.toLowerCase().includes(term) ||
            (med.fornecedor && med.fornecedor.toLowerCase().includes(term)) ||
            (med.tipo && med.tipo.toLowerCase().includes(term))
        );
    }, [medicamentos, searchTerm]);

    // --- CRUD ACTIONS ---

    const handleOpenAddModal = () => {
        setNome('');
        setCategoria('CBAF');
        setQuantidade('');
        setUnidade('Unidade');
        setValidade('');
        setLote('');
        setLimiteMinimo('10');
        setFornecedor('');
        setTipo('Comprimido');
        setDosagem('');
        setIsAddModalOpen(true);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!nome || !quantidade || !validade || !lote || !limiteMinimo) {
            alert('Preencha os campos obrigatórios.');
            return;
        }

        const isDuplicate = medicamentos.some(med => 
            med.nome.toUpperCase() === nome.toUpperCase() &&
            (med.tipo || '').toUpperCase() === tipo.toUpperCase() &&
            (med.dosagem || '').toUpperCase() === (dosagem || '').toUpperCase()
        );

        if (isDuplicate) {
            alert(`Já existe um medicamento cadastrado com o mesmo Nome ("${nome.toUpperCase()}"), Tipo ("${tipo}") e Dosagem ("${dosagem || 'Sem Dosagem'}").`);
            return;
        }

        setSaving(true);
        try {
            const qtyNum = parseInt(quantidade, 10);
            const limitNum = parseInt(limiteMinimo, 10);
            
            const newMed = await db.createMedicamento({
                nome: nome.toUpperCase(),
                categoria,
                quantidade: 0,
                unidade,
                validade,
                lote: lote.toUpperCase(),
                limite_minimo: limitNum,
                tipo,
                dosagem: dosagem || undefined,
                fornecedor: fornecedor || undefined
            });

            if (newMed) {
                // Log the initial stock entry
                await db.registrarMovimentacao({
                    medicamento_id: newMed.id,
                    tipo: 'Entrada',
                    quantidade: qtyNum,
                    medicamento_nome: newMed.nome,
                    medicamento_categoria: newMed.categoria,
                    medicamento_tipo: newMed.tipo,
                    medicamento_dosagem: newMed.dosagem,
                    lote: newMed.lote,
                    validade: newMed.validade,
                    responsavel_nome: currentUser.name,
                    responsavel_id: currentUser.id,
                    observacoes: 'Cadastro inicial de lote'
                });
                alert('Medicamento cadastrado com sucesso!');
                setIsAddModalOpen(false);
                loadData(true);
            }
        } catch (error: any) {
            alert(error.message || 'Erro ao cadastrar medicamento.');
        } finally {
            setSaving(false);
        }
    };

    const handleOpenEditModal = (med: FarmaciaMedicamento) => {
        setSelectedMed(med);
        setNome(med.nome);
        setCategoria(med.categoria);
        setUnidade(med.unidade);
        setValidade(med.validade);
        setLote(med.lote);
        setLimiteMinimo(med.limite_minimo.toString());
        setFornecedor(med.fornecedor || '');
        setTipo(med.tipo || 'Comprimido');
        setDosagem(med.dosagem || '');
        setIsEditModalOpen(true);
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedMed) return;

        const isDuplicate = medicamentos.some(med => 
            med.id !== selectedMed.id &&
            med.nome.toUpperCase() === nome.toUpperCase() &&
            (med.tipo || '').toUpperCase() === tipo.toUpperCase() &&
            (med.dosagem || '').toUpperCase() === (dosagem || '').toUpperCase()
        );

        if (isDuplicate) {
            alert(`Já existe outro medicamento cadastrado com o mesmo Nome ("${nome.toUpperCase()}"), Tipo ("${tipo}") e Dosagem ("${dosagem || 'Sem Dosagem'}").`);
            return;
        }

        setSaving(true);
        try {
            await db.updateMedicamento(selectedMed.id, {
                nome: nome.toUpperCase(),
                categoria,
                unidade,
                validade,
                lote: lote.toUpperCase(),
                limite_minimo: parseInt(limiteMinimo, 10),
                tipo,
                dosagem: dosagem || undefined,
                fornecedor: fornecedor || undefined
            });
            alert('Medicamento atualizado com sucesso!');
            setIsEditModalOpen(false);
            loadData(true);
        } catch (error: any) {
            alert(error.message || 'Erro ao atualizar medicamento.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!window.confirm(`Deseja realmente excluir o lote de "${name}"? Esta ação removerá o lote do estoque.`)) return;
        try {
            const ok = await db.deleteMedicamento(id);
            if (ok) {
                alert('Medicamento excluído do estoque.');
                loadData(true);
            }
        } catch (error: any) {
            alert(error.message || 'Erro ao excluir medicamento.');
        }
    };

    // --- STOCK CONTROL / ADJUSTMENTS ---

    const handleOpenAdjustModal = (med: FarmaciaMedicamento) => {
        setSelectedMed(med);
        setAdjustQty('');
        setAdjustType('Entrada');
        setAdjustReason('');
        setIsAdjustModalOpen(true);
    };

    const handleAdjust = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedMed || !adjustQty) return;
        
        const qtyNum = parseInt(adjustQty, 10);
        if (isNaN(qtyNum) || qtyNum <= 0) {
            alert('Digite uma quantidade inteira válida maior que zero.');
            return;
        }

        if (adjustType === 'Ajuste' && !canApprove) {
            alert('Apenas usuários com permissão de aprovação podem registrar ajustes manuais diretos de estoque.');
            return;
        }

        setSaving(true);
        try {
            await db.registrarMovimentacao({
                medicamento_id: selectedMed.id,
                tipo: adjustType,
                quantidade: qtyNum,
                medicamento_nome: selectedMed.nome,
                medicamento_categoria: selectedMed.categoria,
                medicamento_tipo: selectedMed.tipo,
                medicamento_dosagem: selectedMed.dosagem,
                lote: selectedMed.lote,
                validade: selectedMed.validade,
                responsavel_nome: currentUser.name,
                responsavel_id: currentUser.id,
                observacoes: adjustReason || (adjustType === 'Entrada' ? 'Entrada manual de estoque' : 'Ajuste manual de estoque')
            });
            alert('Operação de estoque registrada com sucesso!');
            setIsAdjustModalOpen(false);
            loadData(true);
        } catch (error: any) {
            alert(error.message || 'Erro ao registrar movimentação.');
        } finally {
            setSaving(false);
        }
    };

    const getStockBadgeColor = (med: FarmaciaMedicamento) => {
        if (med.quantidade === 0) return 'bg-rose-50 text-rose-700 border-rose-100';
        if (med.quantidade <= med.limite_minimo) return 'bg-amber-50 text-amber-700 border-amber-100';
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    };

    const formatDateBr = (d: string) => {
        if (!d) return '';
        const parts = d.split('-');
        if (parts.length !== 3) return d;
        const [year, month, day] = parts;
        return `${day}/${month}/${year}`;
    };

    return (
        <div className="w-full mx-auto flex flex-col flex-1 h-full max-h-full min-h-0 bg-slate-50/20 rounded-3xl border border-slate-200/80 shadow-xl overflow-hidden animate-in fade-in duration-300">
            {/* Main Action Bar */}
            <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white shrink-0">
                <div className="flex items-center gap-2">
                    <SlidersHorizontal className="w-5 h-5 text-pink-600" />
                    <h3 className="font-extrabold text-slate-800 text-sm md:text-base uppercase tracking-tight">Painel de Estoque</h3>
                </div>

                <div className="flex items-center gap-3 self-end sm:self-auto w-full sm:w-auto justify-end">
                    <div className="relative w-full sm:w-[520px]">
                        <input
                            type="text"
                            placeholder="Buscar por medicamento, lote..."
                            className="w-full pl-9 pr-8 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-pink-500 bg-slate-50 focus:bg-white transition-all placeholder:text-slate-400"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {canCreate && (
                        <button
                            onClick={handleOpenAddModal}
                            className="px-4 py-2 bg-pink-600 hover:bg-pink-700 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-md flex items-center gap-2 shrink-0"
                        >
                            <Plus className="w-4 h-4" />
                            Novo Medicamento
                        </button>
                    )}
                </div>
            </div>

            {/* Lote List Container */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar min-h-0">
                <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm flex flex-col w-full">
                    <div className="flex items-center gap-2 mb-4">
                        <Package className="w-5 h-5 text-slate-700" />
                        <h4 className="font-extrabold text-slate-800 text-sm uppercase tracking-tight">Estoque de Medicamentos por Lote</h4>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-100 text-[9px] font-black text-slate-400 uppercase tracking-wider">
                                    <th className="p-3">Medicamento / Categoria</th>
                                    <th className="p-3">Lote</th>
                                    <th className="p-3">Validade</th>
                                    <th className="p-3 text-center">Quantidade</th>
                                    <th className="p-3 text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                                {filteredMedicamentos.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-slate-400 font-semibold italic">
                                            Nenhum lote ou medicamento encontrado.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredMedicamentos.map(med => {
                                        const isExpired = new Date(med.validade).getTime() <= Date.now();
                                    const badgeClass = getStockBadgeColor(med);
                                    return (
                                        <tr key={med.id} className="hover:bg-slate-50/20 transition-colors">
                                            <td className="p-3">
                                                <div className="font-extrabold text-slate-800 uppercase">{med.nome}</div>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    <span className="inline-block px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded bg-pink-50 text-pink-600">
                                                        {med.categoria}
                                                    </span>
                                                    {med.dosagem && (
                                                        <span className="inline-block px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded bg-pink-50 text-pink-700 border border-pink-100">
                                                            {med.dosagem}
                                                        </span>
                                                    )}
                                                    {med.tipo && (
                                                        <span className="inline-block px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded bg-slate-100 text-slate-600">
                                                            {med.tipo}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-3 font-mono font-bold text-slate-500">{med.lote}</td>
                                            <td className="p-3">
                                                <span className={`${isExpired ? 'text-rose-500 font-bold' : 'text-slate-600'}`}>
                                                    {formatDateBr(med.validade)}
                                                    {isExpired && ' (Vencido)'}
                                                </span>
                                            </td>
                                            <td className="p-3 text-center">
                                                <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-black border ${badgeClass}`}>
                                                    {med.quantidade} {med.unidade}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {canCreate && (
                                                        <button
                                                            onClick={() => handleOpenAdjustModal(med)}
                                                            className="px-2 py-1 text-[9px] font-black uppercase bg-pink-50 text-pink-600 hover:bg-pink-100 border border-pink-200/50 rounded-lg"
                                                            title="Entrada / Ajuste manual de estoque"
                                                        >
                                                            Estoque
                                                        </button>
                                                    )}
                                                    {canEdit && (
                                                        <button
                                                            onClick={() => handleOpenEditModal(med)}
                                                            className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg"
                                                            title="Editar dados cadastrais"
                                                        >
                                                            <Edit className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                    {canDelete && (
                                                        <button
                                                            onClick={() => handleDelete(med.id, med.nome)}
                                                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 rounded-lg"
                                                            title="Remover lote"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* ADD MODAL */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200/50 flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="font-extrabold text-slate-800 uppercase text-sm tracking-wide">Cadastrar Novo Lote</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Insira os dados do lote para alimentar o estoque</p>
                            </div>
                            <button onClick={() => setIsAddModalOpen(false)} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="p-6 space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Row 1 */}
                                <div className="md:col-span-2">
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Nome do Medicamento *</label>
                                    <input 
                                        type="text" 
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-semibold text-slate-900 uppercase" 
                                        placeholder="Ex: PARACETAMOL"
                                        value={nome} 
                                        onChange={e => setNome(e.target.value)} 
                                        required 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Lote *</label>
                                    <input 
                                        type="text" 
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-mono font-bold text-slate-900 uppercase" 
                                        placeholder="Ex: A23" 
                                        value={lote} 
                                        onChange={e => setLote(e.target.value)} 
                                        required 
                                    />
                                </div>

                                {/* Row 2 */}
                                {/* Custom Categoria Select */}
                                <div className="relative">
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Categoria *</label>
                                    <div 
                                        onClick={() => {
                                            setIsAddCatOpen(!isAddCatOpen);
                                            setIsAddTipoOpen(false);
                                        }}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm text-slate-900 focus-within:bg-white focus-within:border-pink-500 focus-within:ring-2 focus-within:ring-pink-500/10 outline-none transition-all font-semibold cursor-pointer flex justify-between items-center select-none"
                                    >
                                        <span>
                                            {categoria === 'CBAF' && 'Componente Básico (CBAF)'}
                                            {categoria === 'CESAF' && 'Componente Estratégico (CESAF)'}
                                            {categoria === 'CEAF' && 'Componente Especializado (CEAF)'}
                                        </span>
                                        <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isAddCatOpen ? 'rotate-90' : ''}`} />
                                    </div>

                                    {isAddCatOpen && (
                                        <>
                                            <div className="fixed inset-0 z-40" onClick={() => setIsAddCatOpen(false)} />
                                            <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200/80 rounded-xl shadow-xl z-50 overflow-hidden py-1 animate-in fade-in slide-in-from-top-1 duration-100">
                                                {(['CBAF', 'CESAF', 'CEAF'] as const).map((cat) => (
                                                    <button
                                                        key={cat}
                                                        type="button"
                                                        onClick={() => {
                                                            setCategoria(cat);
                                                            setIsAddCatOpen(false);
                                                        }}
                                                        className={`w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-slate-50 transition-colors flex justify-between items-center ${
                                                            categoria === cat ? 'text-pink-650 bg-pink-50/10 font-bold' : 'text-slate-700'
                                                        }`}
                                                    >
                                                        <span>
                                                            {cat === 'CBAF' && 'Componente Básico (CBAF)'}
                                                            {cat === 'CESAF' && 'Componente Estratégico (CESAF)'}
                                                            {cat === 'CEAF' && 'Componente Especializado (CEAF)'}
                                                        </span>
                                                        {categoria === cat && <CheckCircle2 className="w-3.5 h-3.5 text-pink-600" />}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Custom Tipo Select */}
                                <div className="relative">
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Tipo *</label>
                                    <div 
                                        onClick={() => {
                                            setIsAddTipoOpen(!isAddTipoOpen);
                                            setIsAddCatOpen(false);
                                        }}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm text-slate-900 focus-within:bg-white focus-within:border-pink-500 focus-within:ring-2 focus-within:ring-pink-500/10 outline-none transition-all font-semibold cursor-pointer flex justify-between items-center select-none"
                                    >
                                        <span>{tipo}</span>
                                        <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isAddTipoOpen ? 'rotate-90' : ''}`} />
                                    </div>

                                    {isAddTipoOpen && (
                                        <>
                                            <div className="fixed inset-0 z-40" onClick={() => setIsAddTipoOpen(false)} />
                                            <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200/80 rounded-xl shadow-xl z-50 overflow-hidden py-1 animate-in fade-in slide-in-from-top-1 duration-100">
                                                {['Comprimido', 'Frasco', 'Ampola', 'Creme', 'Outros'].map((t) => (
                                                    <button
                                                        key={t}
                                                        type="button"
                                                        onClick={() => {
                                                            setTipo(t);
                                                            setIsAddTipoOpen(false);
                                                        }}
                                                        className={`w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-slate-50 transition-colors flex justify-between items-center ${
                                                            tipo === t ? 'text-pink-650 bg-pink-50/10 font-bold' : 'text-slate-700'
                                                        }`}
                                                    >
                                                        <span>{t}</span>
                                                        {tipo === t && <CheckCircle2 className="w-3.5 h-3.5 text-pink-600" />}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Dosagem (Ex: 500mg, 10ml)</label>
                                    <input 
                                        type="text" 
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-semibold text-slate-900" 
                                        placeholder="Ex: 500mg" 
                                        value={dosagem} 
                                        onChange={e => setDosagem(e.target.value)} 
                                    />
                                </div>

                                {/* Row 3 */}
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Quantidade Inicial *</label>
                                    <input 
                                        type="number" 
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-bold text-slate-900" 
                                        placeholder="0"
                                        value={quantidade} 
                                        onChange={e => setQuantidade(e.target.value)} 
                                        min="0" 
                                        required 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Unidade *</label>
                                    <input 
                                        type="text" 
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-semibold text-slate-900" 
                                        placeholder="Ex: Comprimidos"
                                        value={unidade} 
                                        onChange={e => setUnidade(e.target.value)} 
                                        required 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Limite Mínimo de Alerta *</label>
                                    <input 
                                        type="number" 
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-bold text-slate-900" 
                                        value={limiteMinimo} 
                                        onChange={e => setLimiteMinimo(e.target.value)} 
                                        min="0" 
                                        required 
                                    />
                                </div>

                                {/* Row 4 */}
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Validade *</label>
                                    <input 
                                        type="date" 
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-semibold text-slate-900 cursor-pointer" 
                                        value={validade} 
                                        onChange={e => setValidade(e.target.value)} 
                                        required 
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Fornecedor</label>
                                    <input 
                                        type="text" 
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-semibold text-slate-900" 
                                        placeholder="Ex: MedSul Distribuidora"
                                        value={fornecedor} 
                                        onChange={e => setFornecedor(e.target.value)} 
                                    />
                                </div>
                            </div>
                            <button type="submit" disabled={saving} className="w-full py-3.5 bg-pink-600 hover:bg-pink-700 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-98">
                                {saving ? 'Salvando...' : 'Cadastrar Medicamento'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* EDIT MODAL */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-200/50 flex flex-col animate-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="font-extrabold text-slate-800 uppercase text-sm tracking-wide">Editar Medicamento</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">Modifique os dados cadastrais do lote</p>
                            </div>
                            <button onClick={() => setIsEditModalOpen(false)} className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleUpdate} className="p-6 space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Row 1 */}
                                <div className="md:col-span-2">
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Nome do Medicamento *</label>
                                    <input 
                                        type="text" 
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-semibold text-slate-900 uppercase" 
                                        value={nome} 
                                        onChange={e => setNome(e.target.value)} 
                                        required 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Lote *</label>
                                    <input 
                                        type="text" 
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-mono font-bold text-slate-900 uppercase" 
                                        value={lote} 
                                        onChange={e => setLote(e.target.value)} 
                                        required 
                                    />
                                </div>

                                {/* Row 2 */}
                                {/* Custom Categoria Select */}
                                <div className="relative">
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Categoria *</label>
                                    <div 
                                        onClick={() => {
                                            setIsEditCatOpen(!isEditCatOpen);
                                            setIsEditTipoOpen(false);
                                        }}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm text-slate-900 focus-within:bg-white focus-within:border-pink-500 focus-within:ring-2 focus-within:ring-pink-500/10 outline-none transition-all font-semibold cursor-pointer flex justify-between items-center select-none"
                                    >
                                        <span>
                                            {categoria === 'CBAF' && 'Componente Básico (CBAF)'}
                                            {categoria === 'CESAF' && 'Componente Estratégico (CESAF)'}
                                            {categoria === 'CEAF' && 'Componente Especializado (CEAF)'}
                                        </span>
                                        <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isEditCatOpen ? 'rotate-90' : ''}`} />
                                    </div>

                                    {isEditCatOpen && (
                                        <>
                                            <div className="fixed inset-0 z-40" onClick={() => setIsEditCatOpen(false)} />
                                            <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200/80 rounded-xl shadow-xl z-50 overflow-hidden py-1 animate-in fade-in slide-in-from-top-1 duration-100">
                                                {(['CBAF', 'CESAF', 'CEAF'] as const).map((cat) => (
                                                    <button
                                                        key={cat}
                                                        type="button"
                                                        onClick={() => {
                                                            setCategoria(cat);
                                                            setIsEditCatOpen(false);
                                                        }}
                                                        className={`w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-slate-50 transition-colors flex justify-between items-center ${
                                                            categoria === cat ? 'text-pink-650 bg-pink-50/10 font-bold' : 'text-slate-700'
                                                        }`}
                                                    >
                                                        <span>
                                                            {cat === 'CBAF' && 'Componente Básico (CBAF)'}
                                                            {cat === 'CESAF' && 'Componente Estratégico (CESAF)'}
                                                            {cat === 'CEAF' && 'Componente Especializado (CEAF)'}
                                                        </span>
                                                        {categoria === cat && <CheckCircle2 className="w-3.5 h-3.5 text-pink-600" />}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Custom Tipo Select */}
                                <div className="relative">
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Tipo *</label>
                                    <div 
                                        onClick={() => {
                                            setIsEditTipoOpen(!isEditTipoOpen);
                                            setIsEditCatOpen(false);
                                        }}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm text-slate-900 focus-within:bg-white focus-within:border-pink-500 focus-within:ring-2 focus-within:ring-pink-500/10 outline-none transition-all font-semibold cursor-pointer flex justify-between items-center select-none"
                                    >
                                        <span>{tipo}</span>
                                        <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${isEditTipoOpen ? 'rotate-90' : ''}`} />
                                    </div>

                                    {isEditTipoOpen && (
                                        <>
                                            <div className="fixed inset-0 z-40" onClick={() => setIsEditTipoOpen(false)} />
                                            <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200/80 rounded-xl shadow-xl z-50 overflow-hidden py-1 animate-in fade-in slide-in-from-top-1 duration-100">
                                                {['Comprimido', 'Frasco', 'Ampola', 'Creme', 'Outros'].map((t) => (
                                                    <button
                                                        key={t}
                                                        type="button"
                                                        onClick={() => {
                                                            setTipo(t);
                                                            setIsEditTipoOpen(false);
                                                        }}
                                                        className={`w-full text-left px-4 py-2.5 text-xs font-semibold hover:bg-slate-50 transition-colors flex justify-between items-center ${
                                                            tipo === t ? 'text-pink-650 bg-pink-50/10 font-bold' : 'text-slate-700'
                                                        }`}
                                                    >
                                                        <span>{t}</span>
                                                        {tipo === t && <CheckCircle2 className="w-3.5 h-3.5 text-pink-600" />}
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Dosagem (Ex: 500mg, 10ml)</label>
                                    <input 
                                        type="text" 
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-semibold text-slate-900" 
                                        value={dosagem} 
                                        onChange={e => setDosagem(e.target.value)} 
                                    />
                                </div>

                                {/* Row 3 */}
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Limite Mínimo de Alerta *</label>
                                    <input 
                                        type="number" 
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-bold text-slate-900" 
                                        value={limiteMinimo} 
                                        onChange={e => setLimiteMinimo(e.target.value)} 
                                        min="0" 
                                        required 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Unidade *</label>
                                    <input 
                                        type="text" 
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-semibold text-slate-900" 
                                        value={unidade} 
                                        onChange={e => setUnidade(e.target.value)} 
                                        required 
                                    />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Validade *</label>
                                    <input 
                                        type="date" 
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-semibold text-slate-900 cursor-pointer" 
                                        value={validade} 
                                        onChange={e => setValidade(e.target.value)} 
                                        required 
                                    />
                                </div>

                                {/* Row 4 */}
                                <div className="md:col-span-3">
                                    <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Fornecedor</label>
                                    <input 
                                        type="text" 
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-semibold text-slate-900" 
                                        value={fornecedor} 
                                        onChange={e => setFornecedor(e.target.value)} 
                                    />
                                </div>
                            </div>
                            <button type="submit" disabled={saving} className="w-full py-3.5 bg-pink-600 hover:bg-pink-700 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-98">
                                {saving ? 'Salvando...' : 'Salvar Alterações'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* ADJUST STOCK MODAL */}
            {isAdjustModalOpen && selectedMed && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200/50">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-extrabold text-slate-800 uppercase text-xs tracking-wide">
                                Movimentação manual de lote: {selectedMed.nome}
                            </h3>
                            <button onClick={() => setIsAdjustModalOpen(false)} className="p-1 hover:bg-slate-200 rounded-lg text-slate-500"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={handleAdjust} className="p-6 space-y-4">
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Tipo de Operação *</label>
                                <select className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs focus:bg-white focus:border-pink-500 outline-none font-semibold text-slate-900" value={adjustType} onChange={e => setAdjustType(e.target.value as any)}>
                                    <option value="Entrada">Entrada (Adiciona quantidade ao estoque atual)</option>
                                    {canApprove && <option value="Ajuste">Ajuste Manual Direto (Força quantidade exata)</option>}
                                </select>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                                    {adjustType === 'Entrada' ? 'Quantidade a Adicionar *' : 'Nova Quantidade em Estoque *'}
                                </label>
                                <div className="relative">
                                    <input type="number" className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs focus:bg-white focus:border-pink-500 outline-none font-bold text-slate-900 pr-16" value={adjustQty} onChange={e => setAdjustQty(e.target.value)} min="1" required />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">{selectedMed.unidade}</span>
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Justificativa / Motivo *</label>
                                <textarea className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs focus:bg-white focus:border-pink-500 outline-none font-semibold text-slate-900 min-h-[70px]" placeholder="Ex: Compra emergencial, ajuste de inventário rotativo..." value={adjustReason} onChange={e => setAdjustReason(e.target.value)} required />
                            </div>
                            <div className="bg-slate-50 border border-slate-200/50 rounded-xl p-3 text-[10px] font-semibold text-slate-400 flex items-start gap-2">
                                <Info className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                                <span>Esta movimentação alterará a contagem física do estoque do lote "{selectedMed.lote}" e será registrada permanentemente no histórico.</span>
                            </div>
                            <button type="submit" disabled={saving} className="w-full py-2.5 bg-pink-600 hover:bg-pink-700 text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all shadow-md">
                                {saving ? 'Registrando...' : 'Salvar Movimentação'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
