import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { Settings, Plus, Trash2, ShieldCheck, Users, HelpCircle, Save, Loader2, Info } from 'lucide-react';
import * as db from '../../services/farmaciaService';
import { useFarmaciaAlert } from './FarmaciaAlertContext';

interface DadosScreenProps {
    currentUser: User;
    onBack: () => void;
    onNavigate: (view: string) => void;
}

export const DadosScreen: React.FC<DadosScreenProps> = ({
    currentUser,
    onBack,
    onNavigate
}) => {
    const { showAlert, showConfirm } = useFarmaciaAlert();

    // Config states
    const [categories, setCategories] = useState<string[]>(['CBAF', 'CESAF', 'CEAF']);
    const [suppliers, setSuppliers] = useState<string[]>([]);
    const [defaultMinLimit, setDefaultMinLimit] = useState<number>(10);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form inputs
    const [newCategory, setNewCategory] = useState('');
    const [newSupplier, setNewSupplier] = useState('');

    const loadConfigs = async () => {
        setLoading(true);
        try {
            const [savedCats, savedSuppliers, savedLimit] = await Promise.all([
                db.getFarmaciaConfig('categorias'),
                db.getFarmaciaConfig('fornecedores'),
                db.getFarmaciaConfig('limite_minimo_padrao')
            ]);

            if (savedCats) setCategories(savedCats);
            if (savedSuppliers) setSuppliers(savedSuppliers);
            if (savedLimit) setDefaultMinLimit(savedLimit);
        } catch (error) {
            console.error('Error loading config:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadConfigs();
    }, []);

    const handleSaveLimit = async () => {
        setSaving(true);
        try {
            await db.saveFarmaciaConfig('limite_minimo_padrao', defaultMinLimit);
            showAlert('Configuração de limite mínimo padrão salva!', 'success');
        } catch (error) {
            showAlert('Erro ao salvar configuração.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleAddCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCategory) return;
        const cat = newCategory.toUpperCase().trim();
        if (categories.includes(cat)) {
            showAlert('Esta categoria já existe.', 'error');
            return;
        }
        const updated = [...categories, cat];
        setCategories(updated);
        setNewCategory('');
        await db.saveFarmaciaConfig('categorias', updated);
    };

    const handleDeleteCategory = async (catToDelete: string) => {
        if (['CBAF', 'CESAF', 'CEAF'].includes(catToDelete)) {
            showAlert('Categorias básicas do SUS (CBAF, CESAF, CEAF) são obrigatórias e não podem ser excluídas.', 'error');
            return;
        }
        showConfirm(`Excluir a categoria "${catToDelete}"?`, async () => {
            const updated = categories.filter(c => c !== catToDelete);
            setCategories(updated);
            await db.saveFarmaciaConfig('categorias', updated);
        });
    };

    const handleAddSupplier = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newSupplier) return;
        const sup = newSupplier.trim();
        if (suppliers.includes(sup)) {
            showAlert('Este fornecedor já está cadastrado.', 'error');
            return;
        }
        const updated = [...suppliers, sup];
        setSuppliers(updated);
        setNewSupplier('');
        await db.saveFarmaciaConfig('fornecedores', updated);
    };

    const handleDeleteSupplier = async (supToDelete: string) => {
        showConfirm(`Remover fornecedor "${supToDelete}"?`, async () => {
            const updated = suppliers.filter(s => s !== supToDelete);
            setSuppliers(updated);
            await db.saveFarmaciaConfig('fornecedores', updated);
        });
    };

    return (
        <div className="w-full mx-auto flex flex-col flex-1 h-full max-h-full min-h-0 bg-slate-50/20 rounded-3xl border border-slate-200/80 shadow-xl overflow-hidden animate-in fade-in duration-300">
            {/* Title Bar */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center bg-white shrink-0 gap-2">
                <Settings className="w-5 h-5 text-pink-600" />
                <h3 className="font-extrabold text-slate-800 text-sm md:text-base uppercase tracking-tight">Área Administrativa</h3>
            </div>

            {loading ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-8 h-8 text-pink-600 animate-spin" />
                    <span className="text-xs font-bold text-slate-400">Carregando configurações...</span>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar min-h-0">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        {/* 1. LIMIT CONFIG & PERMISSIONS CONTROL */}
                        <div className="space-y-6">
                            {/* Stock Threshold settings */}
                            <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm">
                                <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <Settings className="w-4.5 h-4.5 text-pink-600" />
                                    Limites de Estoque
                                </h4>
                                
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
                                            Estoque Mínimo Global Padrão
                                        </label>
                                        <div className="flex gap-2">
                                            <input
                                                type="number"
                                                className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs focus:bg-white focus:border-pink-500 outline-none font-bold text-slate-900 w-24"
                                                value={defaultMinLimit}
                                                onChange={(e) => setDefaultMinLimit(parseInt(e.target.value, 10) || 0)}
                                                min="0"
                                            />
                                            <button
                                                onClick={handleSaveLimit}
                                                disabled={saving}
                                                className="px-4 py-2.5 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-md flex items-center gap-1.5"
                                            >
                                                <Save className="w-3.5 h-3.5" />
                                                Salvar
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-2 font-medium">
                                            Este valor será sugerido como alerta padrão para o cadastro de novos medicamentos.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Access Control redirect card */}
                            <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <ShieldCheck className="w-24 h-24" />
                                </div>

                                <div className="relative z-10 flex flex-col gap-4">
                                    <div className="flex items-center gap-2">
                                        <Users className="w-5 h-5 text-indigo-300" />
                                        <span className="text-xs font-black uppercase tracking-widest">Controle de Acessos</span>
                                    </div>

                                    <p className="text-xs text-slate-300 leading-relaxed font-semibold">
                                        Gerencie quais profissionais de saúde podem dispensar medicamentos, cadastrar lotes, dar baixa ou reajustar o estoque da farmácia.
                                    </p>

                                    <button
                                        onClick={() => onNavigate('admin')}
                                        className="mt-2 w-full py-3 bg-white text-slate-900 hover:bg-indigo-50 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
                                    >
                                        Ir para Gestão de Usuários
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* 2. CATEGORIES AND SUPPLIERS LISTS */}
                        <div className="space-y-6">
                            {/* Categories management */}
                            <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm">
                                <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <Plus className="w-4.5 h-4.5 text-pink-600" />
                                    Categorias de Medicamentos
                                </h4>

                                <form onSubmit={handleAddCategory} className="flex gap-2 mb-4">
                                    <input
                                        type="text"
                                        placeholder="Nova categoria (ex: CORRELATOS)"
                                        className="flex-1 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs focus:bg-white focus:border-pink-500 outline-none font-semibold text-slate-900"
                                        value={newCategory}
                                        onChange={(e) => setNewCategory(e.target.value)}
                                        required
                                    />
                                    <button
                                        type="submit"
                                        className="px-3 bg-slate-100 hover:bg-pink-600 hover:text-white rounded-xl transition-colors border border-slate-200 flex items-center justify-center"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </form>

                                <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                                    {categories.map(cat => {
                                        const isSUS = ['CBAF', 'CESAF', 'CEAF'].includes(cat);
                                        return (
                                            <div key={cat} className="flex items-center justify-between bg-slate-50 border border-slate-100 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-700">
                                                <span>{cat}</span>
                                                {isSUS ? (
                                                    <span className="text-[9px] text-slate-400 font-extrabold uppercase bg-white border px-1.5 py-0.5 rounded">
                                                        Obrigatória SUS
                                                    </span>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDeleteCategory(cat)}
                                                        className="text-slate-400 hover:text-rose-600 transition-colors"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Suppliers management */}
                            <div className="bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm">
                                <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <Plus className="w-4.5 h-4.5 text-pink-600" />
                                    Cadastro de Fornecedores
                                </h4>

                                <form onSubmit={handleAddSupplier} className="flex gap-2 mb-4">
                                    <input
                                        type="text"
                                        placeholder="Nome do Fornecedor..."
                                        className="flex-1 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs focus:bg-white focus:border-pink-500 outline-none font-semibold text-slate-900"
                                        value={newSupplier}
                                        onChange={(e) => setNewSupplier(e.target.value)}
                                        required
                                    />
                                    <button
                                        type="submit"
                                        className="px-3 bg-slate-100 hover:bg-pink-600 hover:text-white rounded-xl transition-colors border border-slate-200 flex items-center justify-center"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </form>

                                <div className="space-y-2 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
                                    {suppliers.length > 0 ? (
                                        suppliers.map(sup => (
                                            <div key={sup} className="flex items-center justify-between bg-slate-50 border border-slate-100 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-700">
                                                <span className="truncate pr-4">{sup}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteSupplier(sup)}
                                                    className="text-slate-400 hover:text-rose-600 transition-colors shrink-0"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-4 border border-dashed rounded-xl text-center text-[10px] font-semibold text-slate-400">
                                            Nenhum fornecedor cadastrado.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            )}
        </div>
    );
};
