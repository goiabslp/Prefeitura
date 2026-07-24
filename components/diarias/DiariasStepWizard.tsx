import React, { useState, useMemo } from 'react';
import { DiariasStepper, StepStatus } from './DiariasStepper';
import { AppState, ContentData, Signature, Person, Sector, Job, BlockType, User } from '../../types';
import { DiariaForm } from '../forms/DiariaForm';
import { ChevronRight, ArrowLeft, CheckCircle2, Loader2, Eye, X } from 'lucide-react';
import { DiariasPreview } from '../DiariasPreview';
interface DiariasStepWizardProps {
    state: AppState;
    content: ContentData;
    allowedSignatures: Signature[];
    handleUpdate: (section: keyof AppState, key: string, value: any) => void;
    onUpdate: React.Dispatch<React.SetStateAction<AppState>>;
    persons: Person[];
    sectors: Sector[];
    jobs: Job[];
    activeBlock: BlockType | null;
    onFinish: () => Promise<boolean | void>;
    onBack?: () => void;
    isLoading?: boolean;
    currentUser?: User;
}

export const DiariasStepWizard: React.FC<DiariasStepWizardProps> = ({
    state, content, allowedSignatures, handleUpdate, onUpdate, persons, sectors, jobs, activeBlock, onFinish, onBack, isLoading = false, currentUser
}) => {
    const [currentStep, setCurrentStep] = useState(2);
    const [showPreview, setShowPreview] = useState(false);

    // --- Status Calculation Logic ---
    const stepsStatus = useMemo(() => {
        const statuses: Record<number, StepStatus> = {};

        // Helper to check validity
        // Step 1: Prompt (Optional context for AI)
        const s1Valid = true; 
        const s1Started = !!(content.promptText && content.promptText.trim().length > 0);

        // Step 2: Modalidade & Solicitante (subType and requesterName required)
        const s2Valid = !!(content.subType && content.requesterName);
        const s2Started = !!(content.subType || content.requesterName);

        // Step 3: Logística & Custos (Destination, Dates, Auth Required)
        const s3Valid = !!(content.destination && content.departureDateTime && content.returnDateTime && content.authorizedBy);
        const s3Started = !!(content.destination || content.departureDateTime || content.returnDateTime || content.authorizedBy || content.lodgingCount || content.distanceKm || content.requestedValue);

        // Step 4: Justificativa (descriptionReason required)
        const s4Valid = !!(content.descriptionReason && content.descriptionReason.trim().length > 0);
        const s4Started = !!(content.descriptionReason || content.extraFieldText);

        // Step 5: Comprovantes (Optional)
        const s5Valid = true; // Optional step, green if items > 0 or when current
        const s5Started = !!(content.evidenceItems && content.evidenceItems.length > 0);

        // Step 6: Assinar
        const s6Valid = !!(content.signatureName);
        const s6Started = false;

        const getStatus = (id: number, isValid: boolean, isStarted: boolean): StepStatus => {
            if (currentStep === id) return 'current';
            if (isValid && isStarted) return 'completed';
            if (isValid && id === 1) return s1Started ? 'completed' : 'empty'; // specific for optional Prompt
            if (isValid && id === 5) return s5Started ? 'completed' : 'empty'; // specific for optional Comprovantes
            if (isStarted) return 'in_progress';
            return 'empty';
        };

        statuses[1] = getStatus(1, s1Valid, s1Started);
        statuses[2] = getStatus(2, s2Valid, s2Started);
        statuses[3] = getStatus(3, s3Valid, s3Started);
        statuses[4] = getStatus(4, s4Valid, s4Started);
        statuses[5] = currentStep === 5 ? 'current' : (s5Started ? 'completed' : 'empty');
        statuses[6] = getStatus(6, s6Valid, s6Started);

        return statuses;
    }, [content, currentStep]);

    // Check Global Completion for "Finalizar" button
    const isAllMandatoryCompleted = useMemo(() => {
        return !!(
            content.subType && content.requesterName && // Step 2
            content.destination && content.departureDateTime && content.returnDateTime && content.authorizedBy && // Step 3
            content.descriptionReason && content.descriptionReason.trim().length > 0 && // Step 4
            content.signatureName // Step 6
        );
    }, [content]);

    const nextStep = () => {
        if (validateStep(currentStep)) {
            setCurrentStep(prev => Math.min(prev + 1, 6));
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const prevStep = () => {
        const minStep = currentUser?.role === 'admin' ? 1 : 2;
        setCurrentStep(prev => Math.max(prev - 1, minStep));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const validateStep = (step: number): boolean => {
        if (step === 2) {
            if (!content.subType) { alert('Selecione a Modalidade (Diária ou Custeio)'); return false; }
            if (!content.requesterName) { alert('Selecione o Solicitante'); return false; }
        }
        if (step === 3) {
            if (!content.destination) { alert('Informe a Cidade de Destino'); return false; }
            if (!content.departureDateTime) { alert('Informe a Data/Hora de Saída'); return false; }
            if (!content.returnDateTime) { alert('Informe a Data/Hora de Retorno'); return false; }
            if (!content.authorizedBy) { alert('Selecione quem autorizou a viagem'); return false; }
        }
        if (step === 4) {
            if (!content.descriptionReason || content.descriptionReason.trim().length === 0) { 
                alert('Preencha a Justificativa Resumida'); 
                return false; 
            }
        }
        return true;
    };

    const handleStepClick = (step: number) => {
        if (isLoading) return;
        if (step === 1 && currentUser?.role !== 'admin') return;
        setCurrentStep(step);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="flex flex-col h-full bg-slate-50">
            {/* Nav Header Row */}
            <div className="sticky top-0 z-40 bg-white border-b border-slate-200 px-6 py-1 flex items-center gap-6 shadow-sm min-h-[50px]">
                {/* 1. Voltar (Padrão) */}
                <button
                    onClick={onBack}
                    disabled={isLoading}
                    className={`flex items-center gap-2 group px-3 py-2 transition-all font-black uppercase tracking-tighter text-[11px] ${isLoading ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-slate-900'}`}
                    title="Voltar ao Menu"
                >
                    <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                    <span>Voltar</span>
                </button>

                {/* 2. Stepper */}
                <div className="flex-1 flex justify-center">
                    <div className="w-full max-w-3xl">
                        <DiariasStepper currentStep={currentStep} stepsStatus={stepsStatus} onStepClick={handleStepClick} isAdmin={currentUser?.role === 'admin'} />
                    </div>
                </div>

                {/* 3. Botão de Ação */}
                <div className="flex items-center justify-end gap-3">
                    <button
                        onClick={() => setShowPreview(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 shadow-sm active:scale-95 transition-all text-sm"
                        title="Visualizar Documento"
                    >
                        <Eye className="w-4 h-4" />
                        <span className="hidden sm:inline">Visualizar</span>
                    </button>
                    {/* Hide Button in Step 6 - Form might handle it, or we leave it here. Let's do like Compras */}
                    {currentStep !== 6 && (
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
            <div className={`flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50 relative custom-scrollbar`}>
                 <div className={`max-w-7xl mx-auto space-y-8 animate-fade-in`}>
                     <DiariaForm
                         state={state}
                         content={content}
                         allowedSignatures={allowedSignatures}
                         handleUpdate={handleUpdate}
                         onUpdate={onUpdate}
                         persons={persons}
                         sectors={sectors}
                         jobs={jobs}
                         activeBlock={activeBlock}
                         currentStep={currentStep}
                         onFinish={onFinish}
                         canFinish={isAllMandatoryCompleted}
                         isLoading={isLoading}
                     />
                 </div>
            </div>
            {/* Modal Preview */}
            {showPreview && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl overflow-hidden relative">
                        <div className="flex items-center justify-between p-4 border-b border-slate-100">
                            <h2 className="font-bold text-slate-800 flex items-center gap-2">
                                <Eye className="w-5 h-5 text-indigo-500" />
                                Visualização do Documento
                            </h2>
                            <button
                                onClick={() => setShowPreview(false)}
                                className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto bg-slate-100 p-8 custom-scrollbar">
                            <div className="max-w-[800px] mx-auto min-h-full">
                                <DiariasPreview state={{ ...state, content }} isGenerating={false} />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
