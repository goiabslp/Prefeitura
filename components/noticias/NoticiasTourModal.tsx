import React, { useState } from 'react';
import {
  Newspaper,
  CalendarDays,
  Sparkles,
  Download,
  Star,
  ArrowRight,
  ArrowLeft,
  X,
  CheckCircle2,
  Share2,
  Layers,
  Image as ImageIcon,
  Flame,
  ShieldCheck,
  ChevronRight,
  FileText
} from 'lucide-react';

interface NoticiasTourModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoToNoticias: () => void;
  onGoToCalendario?: () => void;
}

interface TourStep {
  id: number;
  badge: string;
  badgeColor: string;
  title: string;
  subtitle: string;
  description: string;
  bulletPoints: string[];
  icon: React.ElementType;
  gradient: string;
  previewType: 'portal' | 'calendar' | 'story' | 'featured';
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 1,
    badge: 'NOVO MÓDULO',
    badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-400/30',
    title: 'Portal de Notícias & Gazeta Oficial',
    subtitle: 'A nova central de comunicação, imprensa e transparência municipal',
    description:
      'Apresentamos o novo módulo de Notícias e Jornal Oficial de São José do Goiabal. Acompanhe boletins periódicos, relatórios de atendimentos e reportagens oficiais em tempo real.',
    bulletPoints: [
      'Edições Mensais e Semanais consolidadas',
      'Métricas integradas de Farmácia, Consultas e Veículos',
      'Design editorial premium com leitura imersiva'
    ],
    icon: Newspaper,
    gradient: 'from-indigo-600 to-violet-600',
    previewType: 'portal'
  },
  {
    id: 2,
    badge: 'INTEGRAÇÃO INTELIGENTE',
    badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
    title: 'Crie no Calendário, Vire Notícia com IA',
    subtitle: 'Agende compromissos que se transformam em matérias completas',
    description:
      'Ao criar qualquer evento no Calendário Municipal, basta ativar a opção "Publicar no Jornal". A nossa Inteligência Artificial redige automaticamente manchete, lead e até 1185 caracteres com sua foto oficial!',
    bulletPoints: [
      'Basta marcar a opção "Publicar no Jornal" ao criar o evento',
      'Redação jornalística gerada por IA com padrão de até 1185 caracteres',
      'Upload de foto de até 15MB anexada diretamente à notícia'
    ],
    icon: CalendarDays,
    gradient: 'from-emerald-600 to-teal-600',
    previewType: 'calendar'
  },
  {
    id: 3,
    badge: 'FORMATO STORY 1080x1920',
    badgeColor: 'bg-pink-500/20 text-pink-300 border-pink-400/30',
    title: 'Exportação Imediata para Redes Sociais',
    subtitle: '1 Clique para baixar em alta resolução para Instagram e WhatsApp',
    description:
      'Clique no botão "Baixar Jornal" em qualquer matéria para iniciar o download imediato de um layout editorial em formato vertical Story (1080×1920), pronto para publicação.',
    bulletPoints: [
      'Download direto com 1 único clique no card da matéria',
      'Diagramação vertical em 2 colunas com tipografia elegante',
      'Brasão oficial e certificação de autenticidade municipal'
    ],
    icon: Download,
    gradient: 'from-pink-600 to-rose-600',
    previewType: 'story'
  },
  {
    id: 4,
    badge: 'GESTAO & DESTAQUES',
    badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
    title: 'Destaque Principal & Nuvem em Tempo Real',
    subtitle: 'Destaque reportagens de impacto com sincronização instantânea',
    description:
      'Administradores podem definir matérias como "⭐ Destaque Principal" para colocá-las no topo da página. Todas as notícias ficam salvas no banco de dados e compartilhadas com todos os usuários.',
    bulletPoints: [
      'Botão "⭐ Destacar" com fixação automática no topo',
      'Armazenamento permanente e seguro no banco de dados Supabase',
      'Controle de visibilidade pública e histórico oficial'
    ],
    icon: Star,
    gradient: 'from-amber-500 to-yellow-600',
    previewType: 'featured'
  }
];

export const NoticiasTourModal: React.FC<NoticiasTourModalProps> = ({
  isOpen,
  onClose,
  onGoToNoticias,
  onGoToCalendario
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);

  if (!isOpen) return null;

  const currentStep = TOUR_STEPS[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === TOUR_STEPS.length - 1;

  const handleNext = () => {
    if (!isLastStep) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      onClose();
      onGoToNoticias();
    }
  };

  const handlePrev = () => {
    if (!isFirstStep) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-md animate-fade-in font-sans selection:bg-indigo-500 selection:text-white">
      <div className="bg-slate-900 border border-slate-700/80 rounded-[2.5rem] shadow-2xl max-w-4xl w-full overflow-hidden flex flex-col relative text-white max-h-[92vh]">
        
        {/* Glow de Fundo Animado */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20"></div>

        {/* Topo do Modal */}
        <div className="px-6 sm:px-8 pt-6 pb-4 border-b border-slate-800 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-white">
                  Tour Guiado • Módulo Notícias
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-extrabold text-[10px] uppercase border border-indigo-500/30">
                  Novidade
                </span>
              </div>
              <p className="text-xs text-slate-400 font-medium">
                Conheça os recursos do novo jornal e como publicar pelo calendário
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Fechar Tour"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Progresso com Abas */}
        <div className="px-6 sm:px-8 py-3 bg-slate-950/50 border-b border-slate-800/80 flex items-center justify-between gap-2 overflow-x-auto custom-scrollbar">
          {TOUR_STEPS.map((step, idx) => {
            const isActive = idx === currentStepIndex;
            const isCompleted = idx < currentStepIndex;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setCurrentStepIndex(idx)}
                className={`flex-1 min-w-[140px] py-2 px-3 rounded-xl transition-all flex items-center gap-2 cursor-pointer text-left border ${
                  isActive
                    ? 'bg-slate-800 border-indigo-500/60 shadow-md shadow-indigo-500/10'
                    : isCompleted
                    ? 'bg-slate-900/60 border-slate-700/60 text-slate-400 hover:text-slate-200'
                    : 'bg-transparent border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-black shrink-0 ${
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : isCompleted
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx + 1}
                </div>
                <div className="truncate">
                  <p className={`text-[11px] font-black truncate leading-tight ${isActive ? 'text-white' : 'text-slate-400'}`}>
                    {step.title.split(' ')[0]} {step.title.split(' ')[1] || ''}
                  </p>
                  <p className="text-[9px] text-slate-500 uppercase font-bold">Passo {idx + 1} de {TOUR_STEPS.length}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Conteúdo Principal do Passo */}
        <div className="p-6 sm:p-8 flex-1 overflow-y-auto custom-scrollbar flex flex-col justify-between gap-6 relative z-10">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            
            {/* Lado Esquerdo: Textos e Detalhes */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center gap-2">
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${currentStep.badgeColor}`}>
                  {currentStep.badge}
                </span>
                <span className="text-xs text-slate-500 font-bold">
                  Etapa {currentStepIndex + 1} de {TOUR_STEPS.length}
                </span>
              </div>

              <div>
                <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
                  {currentStep.title}
                </h3>
                <p className="text-sm font-semibold text-indigo-400 mt-1">
                  {currentStep.subtitle}
                </p>
              </div>

              <p className="text-slate-300 text-sm leading-relaxed">
                {currentStep.description}
              </p>

              {/* Bullet Points com ícones */}
              <div className="space-y-2.5 pt-2">
                {currentStep.bulletPoints.map((point, i) => (
                  <div key={i} className="flex items-start gap-2.5 bg-slate-800/60 p-3 rounded-2xl border border-slate-700/50">
                    <div className="w-5 h-5 rounded-md bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    </div>
                    <p className="text-xs text-slate-200 font-medium leading-normal">
                      {point}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Lado Direito: Preview Visual e Mockup Interativo */}
            <div className="lg:col-span-5 flex items-center justify-center">
              <div className="w-full max-w-sm bg-slate-950 p-5 rounded-3xl border border-slate-800 shadow-2xl relative overflow-hidden group">
                
                {/* Visual dinâmico conforme o passo */}
                {currentStep.previewType === 'portal' && (
                  <div className="space-y-3 font-serif">
                    <div className="h-6 bg-slate-900 rounded-lg flex items-center justify-between px-3 text-[10px] font-sans font-black text-slate-400 border border-slate-800">
                      <span>GAZETA MUNICIPAL</span>
                      <span>EDIÇÃO MENSAL</span>
                    </div>
                    <div className="h-32 bg-slate-800 rounded-2xl overflow-hidden relative border border-slate-700">
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent flex flex-col justify-end p-3">
                        <span className="text-[9px] bg-indigo-600 text-white px-2 py-0.5 rounded font-sans font-bold w-fit mb-1">GOVERNO</span>
                        <p className="text-xs font-serif font-black text-white leading-tight">Prefeitura avança com novas obras e investimentos</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px] font-sans">
                      <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
                        <p className="text-slate-400 font-bold">Farmácia</p>
                        <p className="text-emerald-400 font-black text-xs">+1.840 med.</p>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
                        <p className="text-slate-400 font-bold">Consultas</p>
                        <p className="text-sky-400 font-black text-xs">560 atend.</p>
                      </div>
                    </div>
                  </div>
                )}

                {currentStep.previewType === 'calendar' && (
                  <div className="space-y-3 font-sans">
                    <div className="p-3 bg-indigo-950/60 rounded-2xl border border-indigo-500/40 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-black text-indigo-300">
                        <CalendarDays className="w-4 h-4 text-indigo-400" />
                        <span>Novo Evento no Calendário</span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
                        "Inauguração da Nova Unidade de Saúde"
                      </div>
                    </div>

                    <div className="p-3 bg-emerald-950/50 rounded-2xl border border-emerald-500/50 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-emerald-400 animate-spin" />
                        <div>
                          <p className="text-xs font-black text-emerald-300">Publicar no Jornal</p>
                          <p className="text-[10px] text-emerald-400/80">Redação automática por IA</p>
                        </div>
                      </div>
                      <span className="w-8 h-4 rounded-full bg-emerald-500 flex items-center justify-end px-0.5">
                        <span className="w-3 h-3 rounded-full bg-white shadow-sm"></span>
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-400 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span>Upload de foto oficial anexado automaticamente (até 15MB)</span>
                    </div>
                  </div>
                )}

                {currentStep.previewType === 'story' && (
                  <div className="space-y-3 font-sans">
                    <div className="p-3 bg-gradient-to-br from-slate-900 to-indigo-950 rounded-2xl border border-slate-700 text-center space-y-2">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-600/30 border border-indigo-400/30 text-indigo-300 text-[10px] font-black uppercase">
                        <Download className="w-3 h-3" /> Formato Story 1080x1920
                      </div>
                      <p className="text-xs font-bold text-slate-200">
                        Clique em <strong>"Baixar Jornal"</strong> no card da matéria
                      </p>
                    </div>

                    <div className="p-3 bg-indigo-600 text-white rounded-2xl flex items-center justify-between shadow-lg">
                      <div className="flex items-center gap-2">
                        <Download className="w-4 h-4" />
                        <span className="text-xs font-black">Baixar Jornal (PNG)</span>
                      </div>
                      <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-md font-bold">1 Clique</span>
                    </div>

                    <p className="text-[10px] text-slate-400 text-center">
                      Compatível para postagens imediatas no WhatsApp, Instagram e Facebook.
                    </p>
                  </div>
                )}

                {currentStep.previewType === 'featured' && (
                  <div className="space-y-3 font-sans">
                    <div className="p-3 bg-amber-950/40 rounded-2xl border border-amber-500/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-400 text-slate-950 text-[10px] font-black uppercase flex items-center gap-1">
                          <Star className="w-3 h-3 fill-slate-950" /> Destaque
                        </span>
                        <span className="text-[10px] text-amber-300 font-bold">Manchete Topo</span>
                      </div>
                      <p className="text-xs font-serif font-black text-slate-100">
                        Matéria em Destaque Principal visível para todos os usuários
                      </p>
                    </div>

                    <div className="p-2.5 bg-slate-900 rounded-xl border border-slate-800 flex items-center gap-2 text-xs text-slate-300">
                      <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Sincronização em nuvem pelo banco Supabase</span>
                    </div>
                  </div>
                )}

              </div>
            </div>

          </div>

        </div>

        {/* Rodapé com Navegação */}
        <div className="px-6 sm:px-8 py-5 bg-slate-950 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 relative z-10">
          
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
            <button
              type="button"
              onClick={handlePrev}
              disabled={isFirstStep}
              className="px-4 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 font-bold text-xs transition-all disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Anterior</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 text-slate-400 hover:text-slate-200 text-xs font-bold transition-colors cursor-pointer"
            >
              Pular Tour
            </button>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {currentStep.previewType === 'calendar' && onGoToCalendario && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onGoToCalendario();
                }}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-black text-xs transition-all flex items-center gap-1.5 border border-slate-600 cursor-pointer shadow-sm"
              >
                <CalendarDays className="w-4 h-4 text-emerald-400" />
                <span>Ir para o Calendário</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl font-black text-xs transition-all flex items-center gap-2 shadow-lg shadow-indigo-600/30 cursor-pointer active:scale-95"
            >
              <span>{isLastStep ? 'Explorar Módulo Notícias' : 'Próximo Passo'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
