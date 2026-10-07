import React from 'react';
import { FileText, Package, CheckCircle2, DollarSign, MessageSquare, Paperclip, ShieldCheck, CreditCard, Calculator } from 'lucide-react';

export type StepStatus = 'completed' | 'in_progress' | 'empty' | 'current';

interface ComprasStepperProps {
    currentStep: number;
    stepsStatus: Record<number, StepStatus>;
    onStepClick?: (step: number) => void;
    itemCounter?: number;
}

export const ComprasStepper: React.FC<ComprasStepperProps> = ({ currentStep, stepsStatus, onStepClick, itemCounter }) => {
    const steps = [
        { id: 1, label: 'Detalhes', icon: FileText },
        { id: 2, label: 'Itens', icon: Package },
        { id: 3, label: 'Justificativa', icon: MessageSquare },
        { id: 4, label: 'Anexos', icon: Paperclip },
        { id: 5, label: 'Ficha', icon: CreditCard },
        { id: 6, label: 'Origem', icon: FileText },
        { id: 7, label: 'Finalizar', icon: CheckCircle2 },
    ];

    return (
        <div className="w-full py-0.5">
            <div className="flex items-center justify-between w-full relative">
                {steps.map((step, index) => {
                    const status = stepsStatus[step.id] || 'empty';
                    const Icon = step.icon;
                    const isLast = index === steps.length - 1;

                    let circleClass = 'bg-white border border-slate-200 text-slate-300';
                    let labelClass = 'text-slate-400 font-semibold';

                    if (status === 'completed') {
                        circleClass = 'bg-emerald-500 border-emerald-500 text-white';
                        labelClass = 'text-emerald-600 font-bold';
                    } else if (status === 'in_progress') {
                        circleClass = 'bg-amber-500 border-amber-500 text-white';
                        labelClass = 'text-amber-600 font-bold';
                    } else if (status === 'current') {
                        circleClass = 'bg-indigo-600 border-indigo-600 text-white ring-2 ring-indigo-100 shadow-2xs';
                        labelClass = 'text-indigo-600 font-black';
                    }

                    return (
                        <React.Fragment key={step.id}>
                            <div
                                onClick={() => onStepClick && onStepClick(step.id)}
                                className={`flex flex-col items-center gap-0.5 relative z-10 cursor-pointer group px-1 rounded-lg transition-all duration-200 ${status === 'current' ? 'scale-105' : 'hover:scale-102'}`}
                            >
                                <div className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center transition-all relative ${circleClass}`}>
                                    <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                    {step.id === 2 && itemCounter !== undefined && itemCounter > 0 && (
                                        <span className="absolute -top-1 -right-1 min-w-[13px] h-3 px-0.5 bg-emerald-600 text-white rounded-full text-[8px] font-black flex items-center justify-center border border-white shadow-2xs">
                                            {itemCounter}
                                        </span>
                                    )}
                                </div>
                                <span className={`text-[9px] uppercase tracking-tight transition-colors whitespace-nowrap ${labelClass}`}>
                                    {step.label}
                                </span>
                            </div>

                            {!isLast && (
                                <div className="flex-1 h-0.5 mx-1 rounded-full overflow-hidden bg-slate-100 relative -z-10">
                                    <div
                                        className={`h-full transition-all duration-300 ${status === 'completed' ? 'bg-emerald-500' :
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
