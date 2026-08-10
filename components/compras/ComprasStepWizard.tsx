import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ComprasStepper, StepStatus } from './ComprasStepper';
import { AppState, ContentData, DocumentConfig, Signature, Person, Sector, Job } from '../../types';
import { ComprasForm } from '../forms/ComprasForm';
import { ChevronRight, ChevronLeft, ArrowLeft, CheckCircle2, Loader2, CreditCard, Info, AlertTriangle } from 'lucide-react';
import { User } from '../../types';

interface ComprasStepWizardProps {
    state: AppState;
    content: ContentData;
    docConfig: DocumentConfig;
    allowedSignatures: Signature[];
    handleUpdate: (section: keyof AppState, key: string, value: any) => void;
    onUpdate: React.Dispatch<React.SetStateAction<AppState>>;
    persons: Person[];
    sectors: Sector[];
    jobs: Job[];
    onFinish: () => Promise<boolean | void>;
    onBack?: () => void;
    isLoading?: boolean;
    currentUser: User;
}

export const ComprasStepWizard: React.FC<ComprasStepWizardProps> = ({
    state, content, docConfig, allowedSignatures, handleUpdate, onUpdate, persons, sectors, jobs, onFinish, onBack, isLoading = false, currentUser
}) => {
    const [currentStep, setCurrentStep] = useState(1);
    const [showAccountWarning, setShowAccountWarning] = useState(false);
    const [showFichaModal, setShowFichaModal] = useState(false);
    const [hasShownFichaModal, setHasShownFichaModal] = useState(false);
    const [validationWarning, setValidationWarning] = useState<string | null>(null);

    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const mobileStepsList = [
        { key: 'solicitante', title: 'Dados do Solicitante' },
        { key: 'finalidade', title: 'Finalidade do Pedido' },
        { key: 'prioridade', title: 'Prioridade da Compra' },
        { key: 'itens', title: 'Itens do Pedido' },
        { key: 'justificativa', title: 'Justificativa da Compra' },
        { key: 'anexos', title: 'Arquivos Anexos (Opcional)' },
        { key: 'ficha', title: 'Ficha Orçamentária' },
        { key: 'origem', title: 'Origem do Pedido' },
        { key: 'assinatura', title: 'Assinatura e Envio' }
    ];

    useEffect(() => {
        const isFichaStep = (!isMobile && currentStep === 5) || (isMobile && currentStep === 7);
        if (isFichaStep && !hasShownFichaModal) {
            setShowFichaModal(true);
            setHasShownFichaModal(true);
        }
    }, [currentStep, hasShownFichaModal, isMobile]);

    // --- Status Calculation Logic ---
    const stepsStatus = useMemo(() => {
        const statuses: Record<number, StepStatus> = {};

        // Helper to check validity
        const s1Valid = !!(content.title && content.title.length >= 100 && content.requesterName && content.priority);
        const s2Valid = !!(content.purchaseItems && content.purchaseItems.length > 0);
        const s3Valid = !!(content.body && content.body.length >= 400);
        const s4Valid = true; // Optional (Anexos)
        const s5Valid = !!(content.fichaOrcamentaria && content.fichaOrcamentaria !== 'N/A' && content.fichaOrcamentaria.trim() !== ''); // Ficha Orçamentária
        const s6Valid = !!(content.resolucaoDescricao && (content.resolucaoDescricao === 'N/A' || content.resolucaoNumero)); // Origem
        const s7Valid = !!(content.signatureName); // Assinar
 
        // Helper to check "started" (partial) - simple check if ANY field is filled
        const s1Started = !!(content.title || content.requesterName || content.priority);
        const s2Started = false; // Hard to be "partial" on items list, either have items or not
        const s3Started = !!(content.body && content.body.length > 0 && content.body.length < 400);
        const s5Started = !!(content.fichaOrcamentaria && content.fichaOrcamentaria !== 'N/A' && content.fichaOrcamentaria.trim() !== '');
        const s6Started = !!(content.resolucaoDescricao || content.resolucaoNumero);
        const s7Started = false;

        const getStatus = (id: number, isValid: boolean, isStarted: boolean): StepStatus => {
            if (currentStep === id) return 'current';
            if (isValid) return 'completed';
            if (isStarted) return 'in_progress';
            return 'empty';
        };

        statuses[1] = getStatus(1, s1Valid, s1Started);
        statuses[2] = getStatus(2, s2Valid, s2Started);
        statuses[3] = getStatus(3, s3Valid, s3Started);
        statuses[4] = currentStep === 4 ? 'current' : (content.attachments && content.attachments.length > 0 ? 'completed' : 'empty'); // Anexos: Green if has files, else empty
        statuses[5] = getStatus(5, s5Valid, s5Started);
        statuses[6] = getStatus(6, s6Valid, s6Started);
        statuses[7] = getStatus(7, s7Valid, s7Started);

        return statuses;
    }, [content, currentStep]);

    // Check Global Completion for "Finalizar" button
    const isAllMandatoryCompleted = useMemo(() => {
        const hasTitle = !!(content.title && content.title.trim().length > 0);
        const hasRequester = !!(content.requesterName && content.requesterName.trim().length > 0);
        const hasPriority = !!content.priority;
        const hasItems = !!(content.purchaseItems && content.purchaseItems.length > 0);
        const hasBody = !!(content.body && content.body.trim().length > 0);
        const hasOrigem = !!(content.resolucaoDescricao && (content.resolucaoDescricao === 'N/A' || content.resolucaoNumero));
        const hasSignature = !!(content.signatureName || content.digitalSignature?.enabled);

        return hasTitle && hasRequester && hasPriority && hasItems && hasBody && hasOrigem && hasSignature;
    }, [content]);


    const nextStep = () => {
        if (validateStep(currentStep)) {
            setCurrentStep(prev => Math.min(prev + 1, 7));
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const prevStep = () => {
        setCurrentStep(prev => Math.max(prev - 1, 1));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const validateStep = (step: number): boolean => {
        if (isMobile) {
            if (step === 1) {
                if (!content.requesterName) { setValidationWarning('Selecione o Solicitante'); return false; }
            }
            if (step === 2) {
                if (!content.title) { setValidationWarning('Informe a Finalidade do Pedido'); return false; }
                if (content.title.length < 100) { setValidationWarning('A Finalidade do Pedido deve ter no mínimo 100 caracteres.'); return false; }
            }
            if (step === 4) {
                if (!content.purchaseItems || content.purchaseItems.length === 0) {
                    setValidationWarning('Adicione pelo menos um item à lista');
                    return false;
                }
            }
            if (step === 5) {
                if (!content.body) { setValidationWarning('Preencha a Justificativa'); return false; }
                if (content.body.length < 400) { setValidationWarning('A Justificativa do Pedido deve ter no mínimo 400 caracteres.'); return false; }
            }
            if (step === 7) {
                // Ficha Orçamentária não é obrigatória para finalizar o pedido
            }
            if (step === 8) {
                if (!content.resolucaoDescricao || (content.resolucaoDescricao !== 'N/A' && !content.resolucaoNumero)) {
                    setValidationWarning('A Origem (Tipo e Número) é obrigatória.');
                    return false;
                }
            }
        } else {
            if (step === 1) {
                if (!content.title) { setValidationWarning('Informe a Finalidade do Pedido'); return false; }
                if (content.title.length < 100) { setValidationWarning('A Finalidade do Pedido deve ter no mínimo 100 caracteres.'); return false; }
                if (!content.requesterName) { setValidationWarning('Selecione o Solicitante'); return false; }
            }
            if (step === 2) {
                if (!content.purchaseItems || content.purchaseItems.length === 0) {
                    setValidationWarning('Adicione pelo menos um item à lista');
                    return false;
                }
            }
            if (step === 3) {
                if (!content.body) { setValidationWarning('Preencha a Justificativa'); return false; }
                if (content.body.length < 400) { setValidationWarning('A Justificativa do Pedido deve ter no mínimo 400 caracteres.'); return false; }
            }
            if (step === 5) {
                // Ficha Orçamentária não é obrigatória para finalizar o pedido
            }
            if (step === 6) {
                if (!content.resolucaoDescricao || (content.resolucaoDescricao !== 'N/A' && !content.resolucaoNumero)) {
                    setValidationWarning('A Origem (Tipo e Número) é obrigatória.');
                    return false;
                }
            }
        }
        return true;
    };

    const handleStepClick = (step: number) => {
        if (isLoading) return;
        if (step > currentStep) {
            // Validar todos os passos intermediários anteriores
            for (let i = currentStep; i < step; i++) {
                if (!validateStep(i)) return;
            }
        }
        setCurrentStep(step);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    if (isMobile) {
        const totalMobileSteps = mobileStepsList.length;
        const currentMobileStepObj = mobileStepsList[currentStep - 1] || mobileStepsList[0];

        const handleMobileNext = () => {
            if (validateStep(currentStep)) {
                if (currentStep < totalMobileSteps) {
                    setCurrentStep(prev => prev + 1);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                    onFinish();
                }
            }
        };

        const handleMobileBack = () => {
            if (currentStep > 1) {
                setCurrentStep(prev => prev - 1);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                if (onBack) onBack();
            }
        };

        return (
            <div className="flex flex-col h-full bg-slate-100 w-full relative overflow-hidden">
                {/* Barra de progresso e Cabeçalho Mobile */}
                <div className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm shrink-0">
                    {/* Barra de progresso superior */}
                    <div className="w-full h-1.5 bg-slate-100 relative">
                        <div 
                            className="h-full bg-indigo-600 transition-all duration-300 ease-out" 
                            style={{ width: `${(currentStep / totalMobileSteps) * 100}%` }}
                        />
                    </div>
                    
                    <div className="px-4 py-3 flex items-center justify-between">
                        <button 
                            onClick={handleMobileBack}
                            disabled={isLoading}
                            className="p-2 -ml-2 text-slate-500 hover:text-slate-900 active:scale-95 transition-all"
                        >
                            <ChevronLeft className="w-6 h-6" />
                        </button>
                        
                        <div className="text-center">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Passo {currentStep} de {totalMobileSteps}</span>
                            <h2 className="text-xs font-bold text-slate-800">
                                {currentMobileStepObj.title}
                            </h2>
                        </div>
                        
                        <div className="w-10" />
                    </div>
                </div>

                {/* Área central com o formulário */}
                <div className="flex-1 overflow-y-auto p-4 bg-slate-50 relative">
                    <div className="w-full max-w-sm mx-auto">
                        <ComprasForm
                            state={state}
                            content={content}
                            docConfig={docConfig}
                            allowedSignatures={allowedSignatures}
                            handleUpdate={handleUpdate}
                            onUpdate={onUpdate}
                            persons={persons}
                            sectors={sectors}
                            jobs={jobs}
                            currentUser={currentUser}
                            currentStep={currentStep}
                            onFinish={onFinish}
                            canFinish={isAllMandatoryCompleted}
                            isLoading={isLoading}
                            isMobile={true}
                        />
                    </div>
                </div>

                {/* Barra inferior de navegação móvel */}
                <div className="sticky bottom-0 z-40 bg-white border-t border-slate-200 p-4 flex gap-3 shrink-0">
                    <button
                        type="button"
                        onClick={handleMobileBack}
                        disabled={isLoading}
                        className="flex items-center justify-center gap-1.5 py-3 px-5 bg-white border border-slate-200 text-slate-700 font-bold uppercase tracking-widest text-[10px] rounded-xl active:bg-slate-50 disabled:opacity-50 transition-all shadow-sm shrink-0"
                    >
                        <ChevronLeft className="w-4 h-4" />
                        <span>Voltar</span>
                    </button>

                    {currentStep < totalMobileSteps ? (
                        <button
                            type="button"
                            onClick={handleMobileNext}
                            disabled={isLoading}
                            className="flex-1 flex items-center justify-center gap-1.5 py-3 px-6 bg-slate-900 text-white font-bold uppercase tracking-widest text-[10px] rounded-xl active:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-md shadow-slate-950/15"
                        >
                            <span>Avançar</span>
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={onFinish}
                            disabled={!isAllMandatoryCompleted || isLoading}
                            className="flex-1 flex items-center justify-center gap-1.5 py-3 px-6 bg-emerald-600 text-white font-bold uppercase tracking-widest text-[10px] rounded-xl active:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-600/20"
                        >
                            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            <span>{isLoading ? 'Salvando...' : 'Finalizar'}</span>
                        </button>
                    )}
                </div>

                {/* Modais de alertas/avisos herdados */}
                {showFichaModal && createPortal(
                    <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
                        <div className="w-full max-w-md bg-white rounded-[2rem] shadow-2xl border border-slate-100/50 p-8 flex flex-col items-center text-center animate-scale-up relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full blur-3xl opacity-70 -z-10" />
                            <div className="absolute bottom-0 left-0 w-32 h-32 bg-teal-50 rounded-full blur-3xl opacity-70 -z-10" />
                            <div className="w-16 h-16 bg-gradient-to-tr from-emerald-600 to-teal-400 rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-emerald-500/20 rotate-3 hover:rotate-0 transition-transform duration-300">
                                <CreditCard className="w-8 h-8 text-white" />
                            </div>
                            <h4 className="text-xl font-black text-slate-900 tracking-tight leading-tight uppercase">
                                Olá, {currentUser?.name?.split(' ')[0] || 'Usuário'}!
                            </h4>
                            <p className="text-slate-500 font-medium mt-4 text-sm leading-relaxed">
                                A Ficha Orçamentária pode ser informada agora ou posteriormente por um administrador para iniciar o fluxo.
                            </p>
                            <div className="w-full bg-emerald-50/50 border border-emerald-100/50 rounded-2xl p-4 mt-4 text-emerald-800 text-xs font-bold leading-relaxed flex items-start gap-3 text-left">
                                <Info className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                                <span>Procure o setor de contabilidade para inserir o número corretamente.</span>
                            </div>
                            <button
                                onClick={() => setShowFichaModal(false)}
                                className="w-full mt-6 py-4 bg-emerald-600 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-emerald-600/20 hover:bg-emerald-700 hover:shadow-emerald-700/30 transition-all active:scale-[0.97] flex items-center justify-center gap-2"
                            >
                                <span>Entendido</span>
                            </button>
                        </div>
                    </div>,
                    document.body
                )}

                {validationWarning && createPortal(
                    <div className="fixed inset-0 z-[1300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in text-slate-900">
                        <div className="w-full max-w-sm bg-white rounded-[2rem] shadow-2xl border border-slate-100/50 p-8 flex flex-col items-center text-center animate-scale-up relative overflow-hidden">
                            <div className="w-16 h-16 bg-gradient-to-tr from-amber-500 to-yellow-400 rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-amber-500/20 rotate-3 hover:rotate-0 transition-transform duration-300">
                                <AlertTriangle className="w-8 h-8 text-white animate-bounce" />
                            </div>
                            <h4 className="text-xl font-black text-slate-900 tracking-tight leading-tight uppercase">
                                Atenção
                            </h4>
                            <p className="text-slate-600 font-semibold mt-4 text-sm leading-relaxed">
                                {validationWarning}
                            </p>
                            <button
                                onClick={() => setValidationWarning(null)}
                                className="w-full mt-6 py-4 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-slate-900/20 transition-all active:scale-[0.97]"
                            >
                                Entendido
                            </button>
                        </div>
                    </div>,
                    document.body
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* NEW HEADER LAYOUT: Back Button | Stepper | Action Button */}
            <div className="sticky top-0 z-40 bg-white border-b border-slate-200 px-6 py-1 flex items-center gap-6 shadow-sm min-h-[50px]">

                {/* 1. Voltar (Padrão) */}
                <button
                    onClick={onBack}
                    disabled={isLoading}
                    className={`flex items-center gap-2 group px-3 py-2 transition-all font-black uppercase tracking-tighter text-[11px] ${isLoading ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-slate-900'}`}
                    title="Voltar para Compras"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    <span>Voltar</span>
                </button>

                {/* 2. Stepper */}
                <div className="flex-1 flex justify-center">
                    <div className="w-full max-w-3xl">
                        <ComprasStepper currentStep={currentStep} stepsStatus={stepsStatus} onStepClick={handleStepClick} itemCounter={(content.purchaseItems || []).length} />
                    </div>
                </div>

                {/* 3. Botão de Ação (Avançar/Finalizar) */}
                <div className="min-w-[140px] flex justify-end">
                    {/* Hide Button in Step 7 (Assinar) - Form handles it */}
                    {currentStep !== 7 && (
                        !isAllMandatoryCompleted ? (
                            <button
                                onClick={nextStep}
                                disabled={isLoading}
                                className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 shadow-lg shadow-slate-900/20 active:scale-95 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Avançar
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        ) : (
                            <button
                                onClick={onFinish}
                                disabled={isLoading}
                                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 active:scale-95 transition-all text-sm animate-pulse disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                {isLoading ? 'Salvando...' : 'Finalizar'}
                            </button>
                        )
                    )}
                </div>
            </div>

            {/* CONTENT AREA */}
            <div className={`flex-1 ${currentStep === 7 ? 'overflow-hidden flex flex-col justify-center' : 'overflow-y-auto'} p-4 md:p-8 bg-slate-50 relative`}>
                <div className={`max-w-7xl mx-auto ${currentStep === 7 ? 'w-full h-full flex flex-col justify-center' : 'space-y-8'} animate-fade-in`}>
                    <ComprasForm
                        state={state}
                        content={content}
                        docConfig={docConfig}
                        allowedSignatures={allowedSignatures}
                        handleUpdate={handleUpdate}
                        onUpdate={onUpdate}
                        persons={persons}
                        sectors={sectors}
                        jobs={jobs}
                        currentUser={currentUser}
                        currentStep={currentStep}
                        onFinish={onFinish}
                        canFinish={isAllMandatoryCompleted}
                        isLoading={isLoading}
                        isMobile={false}
                    />
                </div>
            </div>

            {showFichaModal && createPortal(
                <div className="fixed inset-0 z-[1200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
                    <div className="w-full max-w-md bg-white rounded-[2rem] shadow-2xl border border-slate-100/50 p-8 flex flex-col items-center text-center animate-scale-up relative overflow-hidden">
                        
                        {/* Fundo decorativo sutil */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full blur-3xl opacity-70 -z-10" />
                        <div className="absolute bottom-0 left-0 w-32 h-32 bg-teal-50 rounded-full blur-3xl opacity-70 -z-10" />

                        {/* Ícone Lindo */}
                        <div className="w-16 h-16 bg-gradient-to-tr from-emerald-600 to-teal-400 rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-emerald-500/20 rotate-3 hover:rotate-0 transition-transform duration-300">
                            <CreditCard className="w-8 h-8 text-white" />
                        </div>

                        {/* Título e Nome */}
                        <h4 className="text-xl font-black text-slate-900 tracking-tight leading-tight uppercase">
                            Olá, {currentUser?.name?.split(' ')[0] || 'Usuário'}!
                        </h4>
                        
                        <p className="text-slate-500 font-medium mt-4 text-sm leading-relaxed">
                            A Ficha Orçamentária pode ser informada agora ou posteriormente por um administrador para iniciar o fluxo.
                        </p>
                        
                        <div className="w-full bg-emerald-50/50 border border-emerald-100/50 rounded-2xl p-4 mt-4 text-emerald-800 text-xs font-bold leading-relaxed flex items-start gap-3 text-left">
                            <Info className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                            <span>Procure o setor de contabilidade para inserir o número corretamente.</span>
                        </div>

                        {/* Botão de Fechar */}
                        <button
                            onClick={() => setShowFichaModal(false)}
                            className="w-full mt-6 py-4 bg-emerald-600 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-emerald-600/20 hover:bg-emerald-700 hover:shadow-emerald-700/30 transition-all active:scale-[0.97] flex items-center justify-center gap-2"
                        >
                            <span>Entendido</span>
                        </button>
                    </div>
                </div>,
                document.body
            )}

            {validationWarning && createPortal(
                <div className="fixed inset-0 z-[1300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in text-slate-900">
                    <div className="w-full max-w-sm bg-white rounded-[2rem] shadow-2xl border border-slate-100/50 p-8 flex flex-col items-center text-center animate-scale-up relative overflow-hidden">
                        
                        {/* Ícone Alerta */}
                        <div className="w-16 h-16 bg-gradient-to-tr from-amber-500 to-yellow-400 rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-amber-500/20 rotate-3 hover:rotate-0 transition-transform duration-300">
                            <AlertTriangle className="w-8 h-8 text-white animate-bounce" />
                        </div>

                        {/* Título */}
                        <h4 className="text-xl font-black text-slate-900 tracking-tight leading-tight uppercase">
                            Atenção
                        </h4>
                        
                        {/* Descrição */}
                        <p className="text-slate-600 font-semibold mt-4 text-sm leading-relaxed">
                            {validationWarning}
                        </p>
                        
                        {/* Botão */}
                        <button
                            onClick={() => setValidationWarning(null)}
                            className="w-full mt-6 py-4 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-slate-900/20 transition-all active:scale-[0.97]"
                        >
                            Entendido
                        </button>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

// Simple Header Helper
const ComHeader = ({ title, subtitle }: { title: string, subtitle: string }) => (
    <div>
        <h2 className="text-xl font-bold text-slate-800">{title}</h2>
        <p className="text-slate-500">{subtitle}</p>
    </div>
);

// Icon import for Step 3 placeholder
import { DollarSign } from 'lucide-react';
