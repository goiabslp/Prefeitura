import React, { useState, useMemo } from 'react';
import { DiariasStepper, StepStatus } from './DiariasStepper';
import { AppState, ContentData, Signature, Person, Sector, Job, BlockType, User } from '../../types';
import { DiariaForm } from '../forms/DiariaForm';
import { ChevronRight, ArrowLeft, CheckCircle2, Loader2 } from 'lucide-react';

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
    const [currentStep, setCurrentStep] = useState(1);

    // --- Status Calculation Logic ---
    const stepsStatus = useMemo(() => {
        const statuses: Record<number, StepStatus> = {};

        // Helper to check validity
        // Step 1: Modalidade & Solicitante (subType and requesterName required)
        const s1Valid = !!(content.subType && content.requesterName);
        const s1Started = !!(content.subType || content.requesterName);

        // Step 2: Logística & Custos (Destination, Dates, Auth Required)
        const s2Valid = !!(content.destination && content.departureDateTime && content.returnDateTime && content.authorizedBy);
        const s2Started = !!(content.destination || content.departureDateTime || content.returnDateTime || content.authorizedBy || content.lodgingCount || content.distanceKm || content.requestedValue);

        // Step 3: Justificativa (descriptionReason required)
        const s3Valid = !!(content.descriptionReason && content.descriptionReason.trim().length > 0);
        const s3Started = !!(content.descriptionReason || content.extraFieldText);

        // Step 4: Comprovantes (Optional)
        const s4Valid = true; // Optional step, green if items > 0 or when current
        const s4Started = !!(content.evidenceItems && content.evidenceItems.length > 0);

        // Step 5: Assinar
        const s5Valid = !!(content.signatureName);
        const s5Started = false;

        const getStatus = (id: number, isValid: boolean, isStarted: boolean): StepStatus => {
            if (currentStep === id) return 'current';
            if (isValid) return 'completed';
            if (isStarted) return 'in_progress';
            return 'empty';
        };

        statuses[1] = getStatus(1, s1Valid, s1Started);
        statuses[2] = getStatus(2, s2Valid, s2Started);
        statuses[3] = getStatus(3, s3Valid, s3Started);
        statuses[4] = currentStep === 4 ? 'current' : (s4Started ? 'completed' : 'empty');
        statuses[5] = getStatus(5, s5Valid, s5Started);

        return statuses;
    }, [content, currentStep]);

    // Check Global Completion for "Finalizar" button
    const isAllMandatoryCompleted = useMemo(() => {
        return !!(
            content.subType && content.requesterName && // Step 1
            content.destination && content.departureDateTime && content.returnDateTime && content.authorizedBy && // Step 2
            content.descriptionReason && content.descriptionReason.trim().length > 0 && // Step 3
            content.signatureName // Step 5
        );
    }, [content]);

    const nextStep = () => {
        if (validateStep(currentStep)) {
            setCurrentStep(prev => Math.min(prev + 1, 5));
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const prevStep = () => {
        setCurrentStep(prev => Math.max(prev - 1, 1));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const validateStep = (step: number): boolean => {
        if (step === 1) {
            if (!content.subType) { alert('Selecione a Modalidade (Diária ou Custeio)'); return false; }
            if (!content.requesterName) { alert('Selecione o Solicitante'); return false; }
        }
        if (step === 2) {
            if (!content.destination) { alert('Informe a Cidade de Destino'); return false; }
            if (!content.departureDateTime) { alert('Informe a Data/Hora de Saída'); return false; }
            if (!content.returnDateTime) { alert('Informe a Data/Hora de Retorno'); return false; }
            if (!content.authorizedBy) { alert('Selecione quem autorizou a viagem'); return false; }
        }
        if (step === 3) {
            if (!content.descriptionReason || content.descriptionReason.trim().length === 0) { 
                alert('Preencha a Justificativa Resumida'); 
                return false; 
            }
        }
        return true;
    };

    const handleStepClick = (step: number) => {
        if (isLoading) return;
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
                        <DiariasStepper currentStep={currentStep} stepsStatus={stepsStatus} onStepClick={handleStepClick} />
                    </div>
                </div>

                {/* 3. Botão de Ação */}
                <div className="min-w-[140px] flex justify-end">
                    {/* Hide Button in Step 5 - Form might handle it, or we leave it here. Let's do like Compras */}
                    {currentStep !== 5 && (
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
        </div>
    );
};
