import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronRight, ChevronLeft, HelpCircle } from 'lucide-react';

export interface TourStep {
    id: string;
    targetId: string;
    title: string;
    content: string;
    position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
    viewChange?: string; // If we need to navigate to a specific view for this step
    stepIndex?: number; // If we need to change the stepper index
}

interface MarketingOnboardingProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: () => void;
    currentView: string;
    onNavigate: (view: string) => void;
    stepperIndex?: number;
    onSetStepperIndex?: (index: number) => void;
}

export const MarketingOnboarding: React.FC<MarketingOnboardingProps> = ({
    isOpen,
    onClose,
    onComplete,
    currentView,
    onNavigate,
    stepperIndex,
    onSetStepperIndex
}) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [tooltipStyles, setTooltipStyles] = useState<React.CSSProperties>({});
    const [highlightStyles, setHighlightStyles] = useState<React.CSSProperties>({});
    const tooltipRef = useRef<HTMLDivElement>(null);

    const steps: TourStep[] = [
        {
            id: 'dashboard-intro',
            targetId: 'tour-dashboard',
            title: 'Boas-vindas ao Marketing!',
            content: 'Este é o seu novo painel de gestão criativa. Vamos te mostrar como navegar por aqui.',
            position: 'center'
        },
        {
            id: 'new-content',
            targetId: 'tour-new-content',
            title: 'Novo Conteúdo',
            content: 'Aqui você inicia uma nova solicitação. Todo o processo é guiado por uma esteira intuitiva.',
            position: 'bottom'
        },
        {
            id: 'list-content',
            targetId: 'tour-list-content',
            title: 'Meus Conteúdos',
            content: 'Acompanhe o status de todas as suas solicitações em tempo real nesta listagem detalhada.',
            position: 'bottom'
        },
        {
            id: 'stepper-intro',
            targetId: 'tour-stepper',
            title: 'Esteira de Produção',
            content: 'O processo é dividido em 5 etapas claras para garantir que nada seja esquecido.',
            viewChange: 'new',
            position: 'bottom'
        },
        {
            id: 'info-fields',
            targetId: 'tour-info-fields',
            title: 'Informações Básicas',
            content: 'Dê um título ao seu pedido. Seu nome e setor são preenchidos automaticamente.',
            viewChange: 'new',
            stepIndex: 0,
            position: 'top'
        },
        {
            id: 'description-fields',
            targetId: 'tour-description-fields',
            title: 'Detalhes da Demanda',
            content: 'Defina as datas, horários e local do evento (se houver), e descreva sua necessidade.',
            viewChange: 'new',
            stepIndex: 1,
            position: 'top'
        },
        {
            id: 'content-items',
            targetId: 'tour-content-items',
            title: 'Peças de Conteúdo',
            content: 'Adicione individualmente cada tipo de material que você precisa (ex: Vídeo, Arte, Texto).',
            viewChange: 'new',
            stepIndex: 2,
            position: 'top'
        },
        {
            id: 'attachments',
            targetId: 'tour-attachments',
            title: 'Anexos',
            content: 'Suba referências, roteiros ou briefings que ajudem a equipe de produção.',
            viewChange: 'new',
            stepIndex: 3,
            position: 'top'
        },
        {
            id: 'signature',
            targetId: 'tour-signature',
            title: 'Assinatura 2FA',
            content: 'Finalize seu pedido com total segurança utilizando sua assinatura digital tokenizada.',
            viewChange: 'new',
            stepIndex: 4,
            position: 'top'
        },
        {
            id: 'status-col',
            targetId: 'tour-status-col',
            title: 'Acompanhamento',
            content: 'A coluna STATUS mostra exatamente em que fase seu pedido se encontra.',
            viewChange: 'list',
            position: 'left'
        },
        {
            id: 'forecast-col',
            targetId: 'tour-forecast-col',
            title: 'Previsão de Entrega',
            content: 'Assim que a produção inicia, você verá aqui a data estimada para conclusão.',
            viewChange: 'list',
            position: 'left'
        },
        {
            id: 'production-tab',
            targetId: 'tour-production-tab',
            title: 'Área de Produção',
            content: 'Aqui a equipe de marketing anexa o conteúdo finalizado para sua aprovação.',
            viewChange: 'details_demo', // Special handling needed
            position: 'top'
        },
        {
            id: 'tour-finish',
            targetId: 'tour-dashboard',
            title: 'Pronto para começar!',
            content: 'Você concluiu o tour. Se precisar de ajuda novamente, clique no botão no topo da tela.',
            position: 'center'
        }
    ];

    const currentStepData = steps[currentStep];

    const updatePosition = () => {
        if (!isOpen) return;

        // If step is "center" or needs view change that isn't ready
        if (currentStepData.position === 'center') {
            setHighlightStyles({ opacity: 0, pointerEvents: 'none' });
            setTooltipStyles({
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                position: 'fixed'
            });
            return;
        }

        const element = document.getElementById(currentStepData.targetId);
        if (!element) {
            // Fallback for missing elements (e.g. view not loaded yet)
            setHighlightStyles({ opacity: 0, pointerEvents: 'none' });
            return;
        }

        const rect = element.getBoundingClientRect();
        const padding = 10;

        setHighlightStyles({
            top: rect.top - padding,
            left: rect.left - padding,
            width: rect.width + padding * 2,
            height: rect.height + padding * 2,
            opacity: 1,
            boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.75)',
            borderRadius: '1.5rem',
            position: 'fixed',
            zIndex: 99998,
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
        });

        const tooltipPos = { top: 0, left: 0 };
        const tooltipMargin = 20;

        if (currentStepData.position === 'bottom') {
            tooltipPos.top = rect.bottom + tooltipMargin;
            tooltipPos.left = rect.left + rect.width / 2;
        } else if (currentStepData.position === 'top') {
            tooltipPos.top = rect.top - tooltipMargin - 150; // Approximated height
            tooltipPos.left = rect.left + rect.width / 2;
        } else if (currentStepData.position === 'left') {
            tooltipPos.top = rect.top + rect.height / 2;
            tooltipPos.left = rect.left - tooltipMargin - 300; // Approximated width
        } else if (currentStepData.position === 'right') {
            tooltipPos.top = rect.top + rect.height / 2;
            tooltipPos.left = rect.right + tooltipMargin;
        }

        // Adjust for viewport bounds
        setTooltipStyles({
            top: Math.max(20, Math.min(window.innerHeight - 200, tooltipPos.top)),
            left: Math.max(20, Math.min(window.innerWidth - 320, tooltipPos.left)),
            transform: currentStepData.position === 'bottom' || currentStepData.position === 'top' ? 'translateX(-50%)' : 'translateY(-50%)',
            position: 'fixed',
            zIndex: 99999,
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
        });
    };

    useEffect(() => {
        if (isOpen) {
            // Handle Navigation Requirements
            if (currentStepData.viewChange) {
                if (currentStepData.viewChange === 'details_demo') {
                    // Logic to open a details demo if none exists or just stay in list
                     onNavigate('list');
                } else if (currentView !== currentStepData.viewChange) {
                    onNavigate(currentStepData.viewChange);
                }
            }

            if (currentStepData.stepIndex !== undefined && onSetStepperIndex) {
                onSetStepperIndex(currentStepData.stepIndex);
            }

            // Small delay to let view change and render happen
            const timer = setTimeout(updatePosition, 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen, currentStep, currentView, stepperIndex]);

    useEffect(() => {
        window.addEventListener('resize', updatePosition);
        return () => window.removeEventListener('resize', updatePosition);
    }, [isOpen, currentStep]);

    if (!isOpen) return null;

    const handleNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            onComplete();
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    return (
        <div className="fixed inset-0 z-[99997] overflow-hidden pointer-events-none">
            {/* Dark Overlay with Highlight Hole */}
            <div 
                className="absolute inset-0 transition-opacity duration-500 bg-slate-900/40"
                style={{ clipPath: highlightStyles.width ? `path('M 0 0 H ${window.innerWidth} V ${window.innerHeight} H 0 Z M ${highlightStyles.left} ${highlightStyles.top} h ${highlightStyles.width} v ${highlightStyles.height} h -${highlightStyles.width} z')` : 'none' }}
            ></div>

            {/* Highlight Box (Visual Only) */}
            <div style={highlightStyles}></div>

            {/* Tooltip */}
            <div 
                ref={tooltipRef}
                style={tooltipStyles}
                className="w-[300px] bg-white rounded-[2rem] shadow-2xl p-6 pointer-events-auto animate-in zoom-in-95 fade-in duration-300 border border-indigo-100 flex flex-col gap-4"
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-indigo-600">
                        <HelpCircle className="w-5 h-5" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Tutorial</span>
                    </div>
                    <button 
                        onClick={onClose}
                        className="w-8 h-8 rounded-full hover:bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div>
                    <h3 className="text-xl font-black text-slate-800 leading-tight mb-2 tracking-tight">
                        {currentStepData.title}
                    </h3>
                    <p className="text-sm text-slate-500 leading-relaxed font-medium">
                        {currentStepData.content}
                    </p>
                </div>

                <div className="flex items-center justify-between mt-2 pt-4 border-t border-slate-50">
                    <div className="flex gap-1">
                        {steps.map((_, i) => (
                            <div 
                                key={i} 
                                className={`h-1 rounded-full transition-all duration-300 ${i === currentStep ? 'w-4 bg-indigo-600' : 'w-1 bg-slate-200'}`}
                            ></div>
                        ))}
                    </div>

                    <div className="flex items-center gap-2">
                        {currentStep > 0 && (
                            <button 
                                onClick={handleBack}
                                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-indigo-600 transition-all border border-slate-100"
                            >
                                <ChevronLeft className="w-5 h-5" />
                            </button>
                        )}
                        <button 
                            onClick={handleNext}
                            className="flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white rounded-xl font-bold text-xs hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all active:scale-95"
                        >
                            {currentStep === steps.length - 1 ? 'Finalizar' : 'Próximo'}
                            {currentStep < steps.length - 1 && <ChevronRight className="w-4 h-4" />}
                        </button>
                    </div>
                </div>

                <button 
                    onClick={onClose}
                    className="absolute -bottom-10 left-1/2 -translate-x-1/2 text-[10px] text-white/60 hover:text-white font-bold uppercase tracking-widest transition-colors cursor-pointer"
                >
                    Pular Tutorial
                </button>
            </div>
        </div>
    );
};
