import React from 'react';
import { FileText, Package, CheckCircle2, DollarSign, MessageSquare, Paperclip, ShieldCheck, CreditCard } from 'lucide-react';

export type StepStatus = 'completed' | 'in_progress' | 'empty' | 'current';

interface LicitacaoStepperProps {
    currentStep: number;
    stepsStatus: Record<number, StepStatus>;
    onStepClick?: (step: number) => void;
}

export const LicitacaoStepper: React.FC<LicitacaoStepperProps> = ({ currentStep, stepsStatus, onStepClick }) => {
    const steps = [
        { id: 1, label: 'Detalhes', icon: FileText },
        { id: 2, label: 'Itens', icon: Package },
        { id: 3, label: 'Justificativa', icon: MessageSquare },
        { id: 4, label: 'Anexos', icon: Paperclip },
        { id: 5, label: 'Assinar', icon: ShieldCheck },
    ];

    return (
        <div className="w-full py-4">
            <div className="flex items-center justify-between w-full relative">
                {steps.map((step, index) => {
                    const status = stepsStatus[step.id] || 'empty';
                    const Icon = step.icon;
                    const isLast = index === steps.length - 1;

                    let circleClass = 'bg-white border-2 border-slate-200 text-slate-300';
                    let labelClass = 'text-slate-400';

                    if (status === 'completed') {
                        circleClass = 'bg-emerald-500 border-emerald-500 text-white';
                        labelClass = 'text-emerald-600 font-bold';
                    } else if (status === 'in_progress') {
                        circleClass = 'bg-amber-500 border-amber-500 text-white';
                        labelClass = 'text-amber-500 font-bold';
                    } else if (status === 'current') {
                        circleClass = 'bg-blue-600 border-blue-600 text-white ring-4 ring-blue-100';
                        labelClass = 'text-blue-600 font-bold';
                    }

                    return (
                        <React.Fragment key={step.id}>
                            <div
                                onClick={() => onStepClick && onStepClick(step.id)}
                                className={`flex flex-col items-center gap-2 relative z-10 cursor-pointer group px-2 bg-white rounded-xl transition-all duration-300 ${status === 'current' ? 'scale-110' : 'hover:scale-105'}`}
                            >
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm ${circleClass}`}>
                                    <Icon className="w-5 h-5" />
                                </div>
                                <span className={`text-[10px] uppercase tracking-wider transition-colors ${labelClass}`}>
                                    {step.label}
                                </span>
                            </div>

                            {!isLast && (
                                <div className="flex-1 h-1 mx-2 rounded-full overflow-hidden bg-slate-100 relative -z-10">
                                    <div
                                        className={`h-full transition-all duration-500 ${status === 'completed' ? 'bg-emerald-500' :
                                                currentStep > step.id ? 'bg-emerald-500' : 'bg-transparent'
                                            }`}
                                    />
                                </div>
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        </div>
    );
};
