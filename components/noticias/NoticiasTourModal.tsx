import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  X,
  CheckCircle2,
  CalendarDays,
  Newspaper,
  Star,
  Download,
  Eye,
  Activity,
  Layers,
  HelpCircle
} from 'lucide-react';

export interface TourStepItem {
  id: number;
  targetSelector: string;
  badge: string;
  badgeColor: string;
  title: string;
  description: string;
  actionHint?: string;
  placement?: 'bottom' | 'top' | 'left' | 'right' | 'auto';
  showCalendarAction?: boolean;
}

const TOUR_STEPS: TourStepItem[] = [
  {
    id: 1,
    targetSelector: '[data-tour="noticias-header"]',
    badge: '1/8 • JORNAL OFICIAL',
    badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    title: 'Portal de Notícias & Jornal Oficial',
    description:
      'Esta é a nova central de imprensa e transparência municipal de São José do Goiabal. Acompanhe edições periódicas e relatórios de atendimentos em tempo real.',
    actionHint: 'Veja no topo a data da edição e o tipo de publicação.',
    placement: 'bottom'
  },
  {
    id: 2,
    targetSelector: '[data-tour="seletor-periodo"]',
    badge: '2/8 • PERIODICIDADE',
    badgeColor: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
    title: 'Edições Mensais & Semanais',
    description:
      'Alterne entre edições consolidadas do mês ou boletins semanais para navegar pelos dados históricos e relatórios públicos.',
    actionHint: 'Você pode escolher qualquer mês ou semana para consultar.',
    placement: 'bottom'
  },
  {
    id: 3,
    targetSelector: '[data-tour="manchete-capa"]',
    badge: '3/8 • MANCHETE DE CAPA',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    title: 'Manchete Principal da Edição',
    description:
      'Aqui fica a matéria de maior relevância ou o balanço geral da administração pública, com foto oficial e destaque editorial.',
    actionHint: 'Clique no card a qualquer momento para abrir a leitura completa.',
    placement: 'bottom'
  },
  {
    id: 4,
    targetSelector: '[data-tour="reportagens-section"]',
    badge: '4/8 • INTEGRAÇÃO COM IA',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    title: 'Reportagens Geradas do Calendário',
    description:
      'Toda reportagem nasce no módulo /Calendario: basta criar um novo evento, anexar uma foto e ativar a opção "Publicar no Jornal". A IA redige a matéria automaticamente!',
    actionHint: 'Eventos cadastrados viram notícias prontas sem retrabalho.',
    placement: 'top',
    showCalendarAction: true
  },
  {
    id: 5,
    targetSelector: '[data-tour="card-noticia-item"]',
    badge: '5/8 • CARDS DE MATÉRIAS',
    badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
    title: 'Card Oficial da Notícia',
    description:
      'Cada matéria exibe a foto oficial, data, categoria, manchete e lead. No rodapé do card, você pode ler a reportagem ou baixar em formato Story.',
    actionHint: 'A foto oficial é otimizada e carregada instantaneamente.',
    placement: 'top'
  },
  {
    id: 6,
    targetSelector: '[data-tour="caderno-saude"]',
    badge: '6/8 • CADERNO DE SAÚDE',
    badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    title: 'Balanço da Assistência Farmacêutica',
    description:
      'Dados consolidados de medicamentos dispensados gratuitamente e total de munícipes atendidos pela Farmácia Popular no período.',
    actionHint: 'Números atualizados e auditados diretamente do banco de dados.',
    placement: 'top'
  },
  {
    id: 7,
    targetSelector: '[data-tour="caderno-regulacao"]',
    badge: '7/8 • REGULAÇÃO & EXAMES',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    title: 'Consultas & Especialidades',
    description:
      'Acompanhe o quantitativo de consultas médicas e exames especializados agendados e realizados pela Secretaria de Saúde.',
    actionHint: 'Transparência ativa sobre a fila e os atendimentos.',
    placement: 'top'
  },
  {
    id: 8,
    targetSelector: '[data-tour="btn-conhecer-modulo"]',
    badge: '8/8 • REINICIAR TOUR',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
    title: 'Tudo Pronto para Navegar!',
    description:
      'Você concluiu a apresentação. Caso queira rever estas orientações futuramente, basta clicar no botão "Conhecer o módulo" no topo da tela.',
    actionHint: 'O tour estará sempre disponível quando você precisar.',
    placement: 'bottom'
  }
];

interface NoticiasTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoToCalendario?: () => void;
}

export const NoticiasTourModal: React.FC<NoticiasTourModalProps> = ({
  isOpen,
  onClose,
  onGoToCalendario
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const currentStep = TOUR_STEPS[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === TOUR_STEPS.length - 1;

  // Atualizar a posição do elemento alvo em tempo real
  const updateTargetPosition = useCallback(() => {
    if (!isOpen || !currentStep) return;

    let targetEl = document.querySelector(currentStep.targetSelector) as HTMLElement;

    // Se o seletor específico não for encontrado, busca fallback seguro
    if (!targetEl) {
      if (currentStep.targetSelector.includes('card-noticia-item')) {
        targetEl = document.querySelector('article') as HTMLElement;
      } else if (currentStep.targetSelector.includes('manchete-capa')) {
        targetEl = document.querySelector('main > div > article, main article') as HTMLElement;
      } else if (currentStep.targetSelector.includes('caderno')) {
        targetEl = document.querySelector('main article') as HTMLElement;
      }
    }

    if (targetEl) {
      const rect = targetEl.getBoundingClientRect();
      setTargetRect(rect);

      // Rolar suavemente para o elemento se estiver fora da visão do usuário
      const isInViewport =
        rect.top >= 60 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) - 60;

      if (!isInViewport) {
        targetEl.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
        // Atualiza após o término do scroll suave
        setTimeout(() => {
          const updatedRect = targetEl.getBoundingClientRect();
          setTargetRect(updatedRect);
        }, 300);
      }
    } else {
      setTargetRect(null);
    }
  }, [isOpen, currentStep]);

  useEffect(() => {
    if (isOpen) {
      updateTargetPosition();
      const timer = setTimeout(updateTargetPosition, 100);

      window.addEventListener('resize', updateTargetPosition);
      window.addEventListener('scroll', updateTargetPosition, true);

      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', updateTargetPosition);
        window.removeEventListener('scroll', updateTargetPosition, true);
      };
    }
  }, [isOpen, currentStepIndex, updateTargetPosition]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (!isLastStep) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (!isFirstStep) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  // Cálculo da posição do Balão Contextual Ancorado
  const calculateTooltipStyle = (): React.CSSProperties => {
    const margin = 14;
    const tooltipWidth = 380;
    const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 768;

    if (!targetRect) {
      // Posição central flutuante elegante caso o elemento alvo não exista
      return {
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        maxWidth: 'calc(100vw - 32px)',
        width: `${tooltipWidth}px`,
        zIndex: 100002
      };
    }

    const isMobile = screenWidth < 640;
    const effectiveWidth = isMobile ? Math.min(tooltipWidth, screenWidth - 32) : tooltipWidth;

    // Alinhamento Horizontal centrado no alvo ou clamped na tela
    let left = targetRect.left + targetRect.width / 2 - effectiveWidth / 2;
    left = Math.max(16, Math.min(left, screenWidth - effectiveWidth - 16));

    // Determinar se fica acima ou abaixo do elemento
    let top = 0;
    const spaceBelow = screenHeight - targetRect.bottom;
    const spaceAbove = targetRect.top;

    if (currentStep.placement === 'top' || (spaceBelow < 280 && spaceAbove > 280)) {
      // Posiciona Acima
      top = Math.max(16, targetRect.top - margin - 260);
    } else {
      // Posiciona Abaixo
      top = Math.min(screenHeight - 280, targetRect.bottom + margin);
    }

    return {
      position: 'fixed',
      top: `${top}px`,
      left: `${left}px`,
      width: `${effectiveWidth}px`,
      maxWidth: 'calc(100vw - 32px)',
      zIndex: 100002
    };
  };

  return createPortal(
    <div className="fixed inset-0 pointer-events-none font-sans z-[100000] selection:bg-indigo-500 selection:text-white">
      
      {/* 1. Backdrop suave com SVG Cutout Spotlight sobre o elemento */}
      <svg
        className="fixed inset-0 w-full h-full pointer-events-none z-[100000] transition-all duration-300"
        style={{ width: '100vw', height: '100vh' }}
      >
        <defs>
          <mask id="tour-spotlight-mask">
            {/* Fundo Branco = Opaco */}
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            {/* Recorte Preto = Furo Transparente para o elemento */}
            {targetRect && (
              <rect
                x={targetRect.left - 6}
                y={targetRect.top - 6}
                width={targetRect.width + 12}
                height={targetRect.height + 12}
                rx="16"
                ry="16"
                fill="black"
              />
            )}
          </mask>
        </defs>

        {/* Fundo escurecido suave aplicando a máscara */}
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(15, 23, 42, 0.65)"
          mask="url(#tour-spotlight-mask)"
        />
      </svg>

      {/* 2. Moldura Luminosa / Glow pulsante ao redor do elemento em foco */}
      {targetRect && (
        <div
          className="fixed pointer-events-none z-[100001] transition-all duration-300 rounded-2xl border-2 border-indigo-400 shadow-[0_0_25px_rgba(99,102,241,0.45)] ring-4 ring-indigo-500/20 animate-pulse"
          style={{
            top: `${targetRect.top - 6}px`,
            left: `${targetRect.left - 6}px`,
            width: `${targetRect.width + 12}px`,
            height: `${targetRect.height + 12}px`
          }}
        />
      )}

      {/* 3. Balão / Popover Contextual com Instruções */}
      <div
        ref={tooltipRef}
        style={calculateTooltipStyle()}
        className="pointer-events-auto bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-3xl shadow-2xl p-5 sm:p-6 text-white flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Topo do Balão com Badge da Etapa e Botão Fechar */}
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${currentStep.badgeColor}`}>
              {currentStep.badge}
            </span>
            <div className="flex items-center gap-1">
              {TOUR_STEPS.map((_, idx) => (
                <span
                  key={idx}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${
                    idx === currentStepIndex ? 'bg-indigo-400 w-3' : idx < currentStepIndex ? 'bg-emerald-400' : 'bg-slate-700'
                  }`}
                />
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Pular / Fechar Tour"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Título e Conteúdo Explicativo */}
        <div className="space-y-1.5">
          <h4 className="text-base sm:text-lg font-black text-white tracking-tight leading-snug">
            {currentStep.title}
          </h4>
          <p className="text-xs text-slate-300 leading-relaxed font-medium">
            {currentStep.description}
          </p>

          {currentStep.actionHint && (
            <div className="pt-2 flex items-center gap-1.5 text-[11px] font-bold text-indigo-300">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span>{currentStep.actionHint}</span>
            </div>
          )}
        </div>

        {/* Rodapé com Navegação */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800 font-sans">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrev}
              disabled={isFirstStep}
              className="px-3 py-1.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 font-bold text-xs transition-all disabled:opacity-20 disabled:pointer-events-none flex items-center gap-1 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-2 py-1 text-slate-400 hover:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
            >
              Pular
            </button>
          </div>

          <div className="flex items-center gap-2">
            {currentStep.showCalendarAction && onGoToCalendario && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onGoToCalendario();
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/40 rounded-xl font-bold text-xs transition-all flex items-center gap-1 cursor-pointer"
              >
                <CalendarDays className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Ver no Calendário</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="px-4 py-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl font-black text-xs transition-all flex items-center gap-1.5 shadow-md shadow-indigo-600/30 cursor-pointer active:scale-95"
            >
              <span>{isLastStep ? 'Concluir ✨' : 'Próximo'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

    </div>,
    document.body
  );
};
