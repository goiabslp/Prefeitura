import React, { useState, useEffect } from 'react';
import { ArrowLeft, Check, ChevronRight, Gavel, Plus, Trash2, FileText, FileSignature, AlertCircle, Save, Loader2, CheckCircle2, ShoppingCart, Minus, ChevronDown, FolderOpen, Download } from 'lucide-react';
import { User } from '../../types';
import { useCreateLicitacaoProcessCompleto, useDeleteLicitacaoDocument } from '../../hooks/useLicitacaoModule';
import { TwoFactorModal } from '../TwoFactorModal';
import { LicitacaoDocumentModal } from './LicitacaoDocumentModal';
import { ConfirmModal } from '../modals/ConfirmModal';
import { ToastNotification, ToastType } from '../common/ToastNotification';

interface LicitacaoWizardProps {
    currentUser: User;
    onBack: () => void;
    initialData?: any;
    readOnly?: boolean;
}

export const LicitacaoWizard: React.FC<LicitacaoWizardProps> = ({ currentUser, onBack, initialData, readOnly }) => {
    const createProcesso = useCreateLicitacaoProcessCompleto();
    const deleteDocument = useDeleteLicitacaoDocument();
    const [currentStep, setCurrentStep] = useState(0);
    const [visitedSteps, setVisitedSteps] = useState<number[]>([0]);
    const [documentToDelete, setDocumentToDelete] = useState<any | null>(null);
    const [toast, setToast] = useState<{ show: boolean, message: string, type: ToastType }>({ show: false, message: '', type: 'info' });
    const [localDocuments, setLocalDocuments] = useState<any[]>([]);

    useEffect(() => {
        const docs = initialData?.documentos || (initialData as any)?.licitacao_documentos || [];
        setLocalDocuments(docs);
    }, [initialData]);

    const showToast = (message: string, type: ToastType = 'info') => {
        setToast({ show: true, message, type });
    };

    useEffect(() => {
        if (!visitedSteps.includes(currentStep)) {
            setVisitedSteps(prev => [...prev, currentStep]);
        }
    }, [currentStep, visitedSteps]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    // Form State
    const [finalidade, setFinalidade] = useState('');
    const [prioridade, setPrioridade] = useState<'Normal' | 'Urgente'>('Normal');
    
    // Items State
    const [itens, setItens] = useState<Array<{ id: string; descricao: string; quantidade: number; unidade: string }>>([]);
    const [newItem, setNewItem] = useState({ descricao: '', quantidade: 1, unidade: 'UN' });
    
    // Justificativa State
    const [justificativa, setJustificativa] = useState('');

    useEffect(() => {
        if (initialData) {
            setFinalidade(initialData.documentSnapshot?.content?.objeto || initialData.title || initialData.finalidade || '');
            setPrioridade(initialData.documentSnapshot?.content?.prioridade || initialData.prioridade || 'Normal');
            
            const fetchedItems = initialData.documentSnapshot?.content?.itens || initialData.licitacao_itens || initialData.itens;
            if (fetchedItems && Array.isArray(fetchedItems)) {
                setItens(fetchedItems.map((item: any, idx: number) => ({
                    id: item.id || Date.now().toString() + idx,
                    descricao: item.descricao || '',
                    quantidade: item.quantidade || 1,
                    unidade: item.observacoes || item.unidade || 'UN'
                })));
            }
            
            let fetchedJustificativa = initialData.documentSnapshot?.content?.justificativa || initialData.justificativa?.texto || '';
            if (!fetchedJustificativa && initialData.licitacao_justificativas) {
                if (Array.isArray(initialData.licitacao_justificativas)) {
                    fetchedJustificativa = initialData.licitacao_justificativas[0]?.texto || '';
                } else {
                    fetchedJustificativa = initialData.licitacao_justificativas.texto || '';
                }
            }
            setJustificativa(fetchedJustificativa);
        }
    }, [initialData]);

    // 2FA State
    const [is2FAModalOpen, setIs2FAModalOpen] = useState(false);

    // Modal Documentos
    const [isDocModalOpen, setIsDocModalOpen] = useState(false);

    const baseSteps = [
        { id: 'detalhes', title: 'DETALHES', icon: FileText },
        { id: 'itens', title: 'ITENS', icon: Plus }, 
        { id: 'justificativa', title: 'JUSTIFICATIVA', icon: AlertCircle }, 
        { id: 'assinar', title: 'ASSINAR', icon: FileSignature },
    ];

    const steps = readOnly 
        ? [...baseSteps, { id: 'processo', title: 'PROCESSO', icon: FolderOpen }]
        : baseSteps;

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            handleSignAndSubmit();
        }
    };

    const handlePrev = () => {
        if (readOnly) {
            onBack();
        } else if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        } else {
            onBack();
        }
    };

    const addEmptyItem = () => {
        setItens([...itens, { 
            id: Date.now().toString(), 
            descricao: '', 
            quantidade: 1, 
            unidade: 'UN'
        }]);
    };

    const updateItem = (id: string, key: string, value: any) => {
        setItens(itens.map(item => item.id === id ? { ...item, [key]: value } : item));
    };

    const removeItem = (id: string) => {
        setItens(itens.filter(item => item.id !== id));
    };

    const isStepValid = () => {
        if (currentStep === 0) return finalidade.trim().length > 0;
        if (currentStep === 1) return itens.length > 0 && itens.every(i => i.descricao.trim().length > 0);
        if (currentStep === 2) return justificativa.trim().length > 0;
        return true;
    };

    const isStepValidByIndex = (index: number) => {
        if (index === 0) return finalidade.trim().length > 0;
        if (index === 1) return itens.length > 0 && itens.every(i => i.descricao.trim().length > 0);
        if (index === 2) return justificativa.trim().length > 0;
        if (index === 3) return isAllValid();
        return true;
    };

    const isStepStartedByIndex = (index: number) => {
        if (index === 0) return finalidade.length > 0 || prioridade !== 'Normal';
        if (index === 1) return itens.length > 0 || newItem.descricao.length > 0;
        if (index === 2) return justificativa.length > 0;
        if (index === 3) return false;
        if (index === 4) return false;
        return false;
    };

    const isAllValid = () => {
        return finalidade.trim().length > 0 && 
               (itens.length > 0 && itens.every(i => i.descricao.trim().length > 0)) && 
               justificativa.trim().length > 0;
    };

    const handleSignAndSubmit = () => {
        if (currentUser.twoFactorSecret) {
            setIs2FAModalOpen(true);
        } else {
            alert('Você não possui 2FA configurado. Configure no seu perfil antes de assinar.');
        }
    };

    const confirmSubmit = async () => {
        setIs2FAModalOpen(false);
        setIsSubmitting(true);
        try {
            await createProcesso.mutateAsync({
                processo: {
                    criado_por: currentUser.id!,
                    solicitante_nome: currentUser.name,
                    solicitante_cargo: currentUser.jobTitle || 'N/A',
                    solicitante_setor: currentUser.sector || 'Geral',
                    finalidade,
                    prioridade,
                },
                itens: itens.map(({ descricao, quantidade, unidade }) => ({
                    descricao, quantidade, observacoes: unidade
                })),
                justificativa: {
                    texto: justificativa
                },
                assinatura: {
                    usuario_id: currentUser.id!,
                    hash_assinatura: '2FA_VERIFIED',
                    ip_address: 'Client-Device',
                    data_assinatura: new Date().toISOString()
                }
            });
            onBack();
        } catch (error) {
            console.error('Erro ao criar processo:', error);
            alert('Ocorreu um erro ao salvar o processo.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col font-sans animate-in fade-in duration-300 bg-[#f8fafc] overflow-hidden relative z-10">
            {/* Top Bar with Stepper */}
            <div className="sticky top-0 z-40 bg-white border-b border-slate-200 px-6 py-1 flex items-center gap-6 shadow-sm min-h-[50px]">
                {/* 1. Voltar */}
                <button
                    onClick={handlePrev}
                    disabled={isSubmitting}
                    className={`flex items-center gap-2 group px-3 py-2 transition-all font-black uppercase tracking-tighter text-[11px] ${isSubmitting ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-slate-900'}`}
                    title="Voltar"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    <span>Voltar</span>
                </button>

                {/* 2. Stepper */}
                <div className="flex-1 flex justify-center">
                    <div className="w-full max-w-3xl">
                        <div className="w-full py-4">
                            <div className="flex items-center justify-between w-full relative">
                                {steps.map((step, index) => {
                                    const isCurrent = index === currentStep;
                                    const Icon = step.icon;
                                    const isLast = index === steps.length - 1;

                                    const isValid = isStepValidByIndex(index);
                                    const isStarted = isStepStartedByIndex(index);

                                    let circleClass = 'bg-slate-100 border-2 border-slate-200 text-slate-400';
                                    let labelClass = 'text-slate-400 font-medium';

                                    if (isCurrent) {
                                        circleClass = 'bg-blue-600 border-blue-600 text-white ring-4 ring-blue-100';
                                        labelClass = 'text-blue-600 font-bold';
                                    } else if (isValid) {
                                        circleClass = 'bg-emerald-500 border-emerald-500 text-white';
                                        labelClass = 'text-emerald-600 font-bold';
                                    } else if (isStarted) {
                                        circleClass = 'bg-orange-400 border-orange-400 text-white';
                                        labelClass = 'text-orange-500 font-bold';
                                    }

                                    return (
                                        <React.Fragment key={step.id}>
                                            <div
                                                onClick={() => {
                                                    if (!isSubmitting) setCurrentStep(index);
                                                }}
                                                className={`flex flex-col items-center gap-2 relative z-10 group px-2 bg-white rounded-xl transition-all duration-300 cursor-pointer hover:scale-105 ${isCurrent ? 'scale-110' : ''}`}
                                            >
                                                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm ${circleClass}`}>
                                                    <Icon className="w-5 h-5" />
                                                </div>
                                                <span className={`text-[10px] uppercase tracking-wider transition-colors ${labelClass}`}>
                                                    {step.title}
                                                </span>
                                            </div>

                                            {!isLast && (
                                                <div className="flex-1 h-1 mx-2 rounded-full overflow-hidden bg-slate-100 relative -z-10">
                                                    <div
                                                        className={`h-full transition-all duration-500 ${isStepValidByIndex(index) ? 'bg-emerald-500' : 'bg-transparent'}`}
                                                    />
                                                </div>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. Botão de Ação */}
                <div className="min-w-[140px] flex justify-end">
                    {currentStep !== steps.length - 1 ? (
                        <button
                            onClick={handleNext}
                            disabled={!isStepValid() || isSubmitting}
                            className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 shadow-lg shadow-slate-900/20 active:scale-95 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Avançar
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    ) : (
                        <button
                            onClick={readOnly ? onBack : handleSignAndSubmit}
                            disabled={(readOnly ? false : !isAllValid()) || isSubmitting}
                            className={`flex items-center gap-2 px-6 py-2.5 ${readOnly ? 'bg-slate-900 hover:bg-slate-800 shadow-slate-900/20' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'} text-white font-bold rounded-xl shadow-lg active:scale-95 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : (readOnly ? <ArrowLeft className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />)}
                            {isSubmitting ? 'Salvando...' : (readOnly ? 'Voltar' : 'Finalizar')}
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-y-auto p-6 md:p-12">
                <div className="max-w-5xl mx-auto space-y-8">
                    
                    {/* Step 1: Detalhes */}
                    {currentStep === 0 && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-5">
                            {/* Bloco: Processo Licitatório */}
                            <div>
                                <div className="flex items-center gap-2 text-emerald-600 mb-2.5 px-1">
                                    <Gavel className="w-4 h-4" />
                                    <h3 className="font-black text-xs tracking-widest uppercase">Processo Licitatório</h3>
                                </div>
                                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-1.5">Finalidade do Processo</label>
                                        <input 
                                            type="text"
                                            value={finalidade}
                                            disabled={readOnly}
                                            onChange={(e) => setFinalidade(e.target.value)}
                                            placeholder="Descreva a finalidade..."
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all text-slate-700 font-medium text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-1.5">Prioridade</label>
                                        <div className="flex gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                                            <button 
                                                onClick={() => setPrioridade('Normal')}
                                                disabled={readOnly}
                                                className={`flex-1 py-1.5 px-4 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${prioridade === 'Normal' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'} ${readOnly ? 'opacity-70 cursor-not-allowed' : ''}`}
                                            >
                                                <AlertCircle className="w-3.5 h-3.5" /> Normal
                                            </button>
                                            <button 
                                                onClick={() => setPrioridade('Urgente')}
                                                disabled={readOnly}
                                                className={`flex-1 py-1.5 px-4 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${prioridade === 'Urgente' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'} ${readOnly ? 'opacity-70 cursor-not-allowed' : ''}`}
                                            >
                                                <AlertCircle className="w-3.5 h-3.5" /> Urgente
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Bloco: Dados do Solicitante */}
                            <div>
                                <div className="flex items-center gap-2 text-emerald-600 mb-2.5 px-1">
                                    <AlertCircle className="w-4 h-4" />
                                    <h3 className="font-black text-xs tracking-widest uppercase">Dados do Solicitante</h3>
                                </div>
                                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-5">
                                    <div>
                                        <label className="block text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-1.5">Nome Completo</label>
                                        <input 
                                            type="text"
                                            value={currentUser.name}
                                            disabled
                                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-600 font-medium text-sm"
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <div>
                                            <label className="block text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-1.5">Cargo</label>
                                            <input 
                                                type="text"
                                                value={currentUser.jobTitle || 'N/A'}
                                                disabled
                                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-600 font-medium text-sm"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold tracking-widest text-slate-400 uppercase mb-1.5">Setor</label>
                                            <input 
                                                type="text"
                                                value={currentUser.sector || 'Geral'}
                                                disabled
                                                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-600 font-medium text-sm"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Itens */}
                    {currentStep === 1 && (
                        <div className="space-y-4 border-t border-slate-200 pt-6">
                            <div className="mb-6">
                                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                    <Plus className="w-4 h-4 text-emerald-600" /> Itens da Requisição
                                </h3>
                            </div>

                            <div className="space-y-4">
                                {itens.map((item, index) => (
                                    <div key={item.id} className="flex gap-4 sm:gap-6 items-stretch transition-all duration-300 relative">
                                        {/* EXTERNAL COUNTER */}
                                        <div className="flex flex-col items-center pt-2">
                                            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-sm sm:text-base shadow-lg shadow-slate-900/20 z-10">
                                                {index + 1}
                                            </div>
                                            {/* Connecting Line */}
                                            {index < itens.length - 1 && (
                                                <div className="w-0.5 flex-1 bg-slate-200 mt-2 mb-2 rounded-full" />
                                            )}
                                        </div>

                                        {/* ITEM CARD */}
                                        <div className="flex-1 bg-white rounded-2xl p-5 border border-slate-100 hover:border-emerald-500/30 hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300 ease-out group">
                                            <div className="flex flex-col md:flex-row md:items-center gap-4 sm:gap-6">
                                                {/* Description */}
                                                <div className="flex-1 min-w-0">
                                                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1 flex items-center gap-2">
                                                        Descrição do Item
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={item.descricao}
                                                        disabled={readOnly}
                                                        onChange={(e) => updateItem(item.id, 'descricao', e.target.value)}
                                                        placeholder="Ex: Material de escritório..."
                                                        className={`w-full text-base sm:text-lg font-medium text-slate-800 bg-transparent border-b-2 outline-none transition-all py-2 sm:py-1 ${!item.descricao.trim() ? 'border-red-300 hover:border-red-400 focus:border-red-500 focus:bg-red-50/50 placeholder:text-red-300' : 'border-slate-100 hover:border-slate-300 focus:border-emerald-500 focus:bg-slate-50/50 placeholder:text-slate-300'}`}
                                                    />
                                                    {!item.descricao.trim() && (
                                                        <span className="text-[10px] text-red-500 font-bold tracking-widest uppercase mt-1.5 block">
                                                            Obrigatório preencher a descrição do item
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Controls */}
                                                <div className="flex items-end md:items-center gap-3 sm:gap-4">
                                                    {/* Quantity */}
                                                    <div className="w-28 sm:w-32">
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1 block">
                                                            Quantidade
                                                        </label>
                                                        <div className="flex items-center bg-slate-50 rounded-xl border border-slate-200 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/10 transition-all h-[42px]">
                                                            <button
                                                                type="button"
                                                                disabled={readOnly}
                                                                onClick={() => {
                                                                    const newQ = Math.max(1, item.quantidade - 1);
                                                                    updateItem(item.id, 'quantidade', newQ);
                                                                }}
                                                                className="w-10 h-full flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50/50 rounded-l-xl transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                                            >
                                                                <Minus className="w-3.5 h-3.5" />
                                                            </button>
                                                            <input
                                                                type="number"
                                                                min="1"
                                                                disabled={readOnly}
                                                                value={item.quantidade}
                                                                onChange={(e) => updateItem(item.id, 'quantidade', Number(e.target.value))}
                                                                className="flex-1 w-full min-w-0 bg-transparent border-none text-center text-sm font-bold text-slate-700 outline-none h-full appearance-none disabled:opacity-70"
                                                            />
                                                            <button
                                                                type="button"
                                                                disabled={readOnly}
                                                                onClick={() => {
                                                                    updateItem(item.id, 'quantidade', item.quantidade + 1);
                                                                }}
                                                                className="w-10 h-full flex items-center justify-center text-slate-400 hover:text-emerald-600 hover:bg-emerald-50/50 rounded-r-xl transition-colors active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                                            >
                                                                <Plus className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Unit */}
                                                    <div className="w-24 sm:w-32">
                                                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1 block">
                                                            Unidade
                                                        </label>
                                                        <select
                                                            value={item.unidade}
                                                            disabled={readOnly}
                                                            onChange={(e) => updateItem(item.id, 'unidade', e.target.value)}
                                                            className="w-full h-[42px] px-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all cursor-pointer appearance-none"
                                                        >
                                                            <option value="UN">UN</option>
                                                            <option value="KG">KG</option>
                                                            <option value="CX">CX</option>
                                                            <option value="LT">LT</option>
                                                            <option value="M">M</option>
                                                        </select>
                                                    </div>

                                                    {/* Delete */}
                                                    {!readOnly && (
                                                        <div className="h-[42px] flex items-end">
                                                            <button
                                                                onClick={() => removeItem(item.id)}
                                                                className="w-[42px] h-[42px] flex items-center justify-center rounded-xl text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all active:scale-95"
                                                            >
                                                                <Trash2 className="w-5 h-5" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {itens.length === 0 && (
                                    <div className="p-10 sm:p-16 border-2 border-dashed border-slate-200 rounded-[2.5rem] text-center bg-white/50 backdrop-blur-sm">
                                        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-slate-100 rounded-3xl flex items-center justify-center text-slate-300 mx-auto mb-6 shadow-inner">
                                            <ShoppingCart className="w-8 h-8 sm:w-10 sm:h-10" />
                                        </div>
                                        <p className="font-black text-slate-700 text-lg">Sua lista está vazia</p>
                                        <p className="text-sm text-slate-400 mt-2 max-w-xs mx-auto">Adicione produtos ou serviços para compor sua requisição.</p>
                                    </div>
                                )}
                            </div>

                            <div className="h-28 sm:h-32" />

                            {!readOnly && (
                                <button
                                    onClick={addEmptyItem}
                                    className="fixed bottom-6 right-6 sm:bottom-10 sm:right-10 z-[60] group flex items-center justify-center gap-2 px-6 py-4 bg-emerald-600 text-white rounded-full text-xs font-bold uppercase tracking-widest shadow-2xl shadow-emerald-600/40 hover:bg-emerald-700 hover:scale-105 active:scale-95 transition-all outline-none animate-in fade-in zoom-in"
                                >
                                    <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                                    <span className="hidden sm:inline">Adicionar Itens</span>
                                    <span className="inline sm:hidden">Add</span>
                                </button>
                            )}
                        </div>
                    )}

                    {/* Step 3: Justificativa */}
                    {currentStep === 2 && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
                            <h2 className="text-2xl font-black text-slate-800 mb-2">Justificativa da Licitação</h2>
                            <p className="text-slate-500 mb-6">Descreva os motivos pelos quais esta licitação se faz necessária.</p>
                            <textarea 
                                value={justificativa}
                                disabled={readOnly}
                                onChange={(e) => setJustificativa(e.target.value)}
                                placeholder="Digite o embasamento legal e técnico..."
                                className="w-full h-80 p-6 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none resize-none text-slate-700 leading-relaxed"
                            />
                        </div>
                    )}

                    {/* Step 4: Assinar */}
                    {currentStep === 3 && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center max-w-2xl mx-auto">
                            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner border border-blue-100">
                                <FileSignature className="w-8 h-8" />
                            </div>
                            <h2 className="text-2xl font-black text-slate-800 mb-2">{readOnly ? 'Assinatura Registrada' : 'Pronto para Assinar'}</h2>
                            <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                                {readOnly 
                                    ? 'Este processo licitatório já foi finalizado e os dados foram registrados no sistema.' 
                                    : 'Você está prestes a concluir e assinar este processo licitatório. As informações serão registradas e enviadas para os setores responsáveis.'}
                            </p>
                            
                            <div className="bg-slate-50 rounded-xl p-5 text-left space-y-3 mb-6 border border-slate-100">
                                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                                    <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Finalidade</span>
                                    <span className="text-slate-800 font-medium text-sm">{finalidade}</span>
                                </div>
                                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                                    <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Prioridade</span>
                                    <span className={`font-bold px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider ${prioridade === 'Urgente' ? 'bg-red-100 text-red-600' : 'bg-slate-200 text-slate-700'}`}>{prioridade}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Total de Itens</span>
                                    <span className="text-slate-800 font-medium text-sm">{itens.length} registrados</span>
                                </div>
                            </div>

                            {!readOnly && (
                                <button
                                    onClick={handleSignAndSubmit}
                                    disabled={!isAllValid() || isSubmitting}
                                    className="w-full flex items-center justify-center gap-3 px-8 py-4 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 active:scale-95 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <CheckCircle2 className="w-5 h-5" />
                                    Assinar e Autenticar com 2FA
                                </button>
                            )}
                        </div>
                    )}

                    {/* Step 5: Processo (Apenas ReadOnly) */}
                    {readOnly && currentStep === 4 && (
                        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-800 flex items-center gap-3">
                                        <FolderOpen className="w-6 h-6 text-emerald-600" />
                                        Processo e Documentos
                                    </h2>
                                    <p className="text-slate-500 text-sm mt-1">Anexos e documentos oficiais vinculados a este processo licitatório.</p>
                                </div>
                                
                                {(currentUser.role === 'admin' || currentUser.role === 'licitacao') && (
                                    <button
                                        onClick={() => setIsDocModalOpen(true)}
                                        className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 active:scale-95 transition-all text-sm"
                                    >
                                        <Plus className="w-4 h-4" />
                                        Anexar Documento
                                    </button>
                                )}
                            </div>

                            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
                                {localDocuments.length > 0 ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {localDocuments.map((doc: any) => (
                                            <div key={doc.id} className="group relative border border-slate-200 rounded-xl p-4 hover:border-emerald-500 hover:shadow-md transition-all">
                                                <div className="flex items-start justify-between mb-3">
                                                    <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                                                        <FileText className="w-5 h-5" />
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <a 
                                                            href={doc.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-slate-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-colors"
                                                            title="Baixar/Visualizar"
                                                        >
                                                            <Download className="w-4 h-4" />
                                                        </a>
                                                        {(currentUser.role === 'admin' || currentUser.role === 'licitacao') && (
                                                            <button
                                                                onClick={() => setDocumentToDelete(doc)}
                                                                className="text-slate-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                                                                title="Excluir"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                <h4 className="font-bold text-slate-800 text-sm line-clamp-2" title={doc.nome_documento}>
                                                    {doc.nome_documento}
                                                </h4>
                                                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-2">
                                                    {doc.criado_em ? new Date(doc.criado_em).toLocaleDateString('pt-BR') : 'Sem data'}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-12 px-4 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">
                                        <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                        <h3 className="text-slate-700 font-bold mb-1">Nenhum documento anexado</h3>
                                        <p className="text-slate-500 text-sm">Este processo ainda não possui arquivos ou documentos.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                </div>
            </div>

            {/* 2FA Modal Integration */}
            {is2FAModalOpen && (
                <TwoFactorModal
                    isOpen={is2FAModalOpen}
                    onClose={() => setIs2FAModalOpen(false)}
                    onConfirm={confirmSubmit}
                    secret={currentUser.twoFactorSecret!}
                    signatureName={currentUser.name}
                />
            )}

            {/* Licitacao Document Upload Modal */}
            {isDocModalOpen && initialData?.id && (
                <LicitacaoDocumentModal
                    isOpen={isDocModalOpen}
                    onClose={() => setIsDocModalOpen(false)}
                    processoId={initialData.id}
                    currentUser={currentUser}
                    onSuccess={(newDoc) => {
                        setLocalDocuments(prev => [...prev, newDoc]);
                        showToast('Documento anexado com sucesso!', 'success');
                    }}
                />
            )}

            {/* Confirm Delete Modal */}
            <ConfirmModal
                isOpen={documentToDelete !== null}
                onClose={() => setDocumentToDelete(null)}
                onConfirm={async () => {
                    if (documentToDelete && initialData?.id) {
                        try {
                            // Optimistically remove from UI
                            setLocalDocuments(prev => prev.filter(d => d.id !== documentToDelete.id));
                            
                            await deleteDocument.mutateAsync({ 
                                id: documentToDelete.id, 
                                processo_id: initialData.id,
                                url: documentToDelete.url
                            });
                            setDocumentToDelete(null);
                            showToast('Documento removido com sucesso!', 'success');
                        } catch (e: any) {
                            // Revert optimistic update on failure
                            const docs = initialData?.documentos || (initialData as any)?.licitacao_documentos || [];
                            setLocalDocuments(docs);
                            showToast(e.message || 'Erro ao remover documento.', 'error');
                        }
                    }
                }}
                title="Excluir Documento"
                description={`Tem certeza que deseja excluir permanentemente o documento "${documentToDelete?.nome_documento}"? Esta ação não pode ser desfeita.`}
                confirmText="Excluir"
                cancelText="Cancelar"
                type="danger"
                isLoading={deleteDocument.isPending}
            />

            <ToastNotification
                isVisible={toast.show}
                message={toast.message}
                type={toast.type}
                onClose={() => setToast(prev => ({ ...prev, show: false }))}
            />
        </div>
    );
};
