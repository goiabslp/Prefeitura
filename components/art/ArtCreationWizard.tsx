import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, Sparkles, Check, Upload, Image as ImageIcon, Shield, Calendar,
  Clock, MapPin, Tag, RefreshCw, Eye, Download, Layers, CheckCircle2, ChevronRight,
  Sliders, ChevronLeft, Star, Edit3, Wand2, Loader2, X
} from 'lucide-react';
import { ArtPublication, ArtVariation, ArtFormatType, ArtLogoItem, ArtReferenceItem } from '../../types';
import { artStudioService } from '../../services/artStudioService';
import { ArtCanvasRenderer } from './ArtCanvasRenderer';

interface ArtCreationWizardProps {
  onBack: () => void;
  onNavigate: (route: string) => void;
  onEditPublication?: (pubId: string) => void;
  initialPublication?: ArtPublication | null;
}

// Comandos pré-definidos para direção de arte direta e de alto impacto para a IA
const AI_PRESET_COMMANDS = [
  { label: '⚖️ Padrão: Equilíbrio harmônico e fiel às referências', value: '' },
  { label: '⚡ Destaque Máximo no Título (Tipografia imponente e leitura instantânea)', value: 'Priorizar destaque máximo no Título Principal e na Palavra de Impacto, com contraste visual marcante e presença imponente.' },
  { label: '📅 Foco Total na Data, Horário e Local (Comunicação de Evento / Prazo)', value: 'Destacar de forma prioritária as informações de Data, Horário e Local do evento com caixa de dados visualmente forte e chamativa.' },
  { label: '🏛️ Tom Institucional Solene (Sério, governamental, tradicional e cívico)', value: 'Adotar tom institucional solene, formal e governamental, com estrutura sóbria, azul cívico e tipografia nobre.' },
  { label: '💚 Tom Humanizado e Acolhedor (Saúde, cidadania, proteção e carinho)', value: 'Adotar tom acolhedor, caloroso e humanizado, transmitindo cuidado, empatia e proteção à população.' },
  { label: '🏆 Esporte e Competição (Enérgico, dinâmico, vibrante e motivador)', value: 'Estilo esportivo enérgico e dinâmico, transmitindo emoção de final de campeonato, alto impacto e espírito de vitória.' },
  { label: '🎉 Festivo e Cultural (Celebração popular, vivacidade, alegria e eventos)', value: 'Estilo festivo, alegre e comemorativo, com cores vibrantes e apelo de grande celebração popular.' },
  { label: '🏗️ Progresso e Obras (Modernidade, infraestrutura, solidez e investimento)', value: 'Transmitir solidez, modernidade e desenvolvimento da cidade, com linhas limpas e sensação de conquista e avanço.' },
  { label: '📚 Educação e Futuro (Inspirador, iluminado, inclusivo e construtivo)', value: 'Tom inspirador e educativo, valorizando o conhecimento, o futuro das crianças e o desenvolvimento social.' },
  { label: '🚨 Alerta e Utilidade Pública (Prevenção, vacinação urgente e convocação)', value: 'Tom de alerta positivo e utilidade pública imediata, destacando a chamada para ação com urgência e clareza absoluta.' },
  { label: '✨ Minimalista e Elegante (Visual limpo, amplo respiro e sofisticação)', value: 'Abordagem minimalista e refinada, com amplo respiro visual, tipografia moderna e sofisticação institucional.' },
  { label: '✏️ Personalizado (Digitar comando específico...)', value: 'custom' }
];

// Constantes para o Calendário Aberto e Selects Modernos
const MONTH_NAMES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];
const WEEKDAYS_SHORT_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const HOURS_LIST = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES_LIST = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

export const ArtCreationWizard: React.FC<ArtCreationWizardProps> = ({
  onBack,
  onNavigate,
  onEditPublication,
  initialPublication
}) => {
  // Etapas: 1: Info, 2: Imagens, 3: Resultado
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Dados do formulário
  const [title, setTitle] = useState<string>(initialPublication?.title || '');
  const [subtitle, setSubtitle] = useState<string>(initialPublication?.subtitle || '');
  const [description, setDescription] = useState<string>(initialPublication?.description || '');
  const [eventDate, setEventDate] = useState<string>(initialPublication?.eventDate || '');
  const [eventTime, setEventTime] = useState<string>(initialPublication?.eventTime || '');
  const [eventLocation, setEventLocation] = useState<string>(initialPublication?.eventLocation || '');
  const [category, setCategory] = useState<string>(initialPublication?.category || 'Saúde Pública');
  const [ctaText, setCtaText] = useState<string>(initialPublication?.ctaText || 'Participe!');
  const [notesForAI, setNotesForAI] = useState<string>(initialPublication?.notesForAI || '');

  // Gestão de comando pré-definido para a IA
  const [selectedCommandPreset, setSelectedCommandPreset] = useState<string>(() => {
    if (!initialPublication?.notesForAI) return '';
    const match = AI_PRESET_COMMANDS.find(c => c.value === initialPublication.notesForAI);
    return match ? match.value : 'custom';
  });
  const [customNotes, setCustomNotes] = useState<string>(() => {
    const match = AI_PRESET_COMMANDS.find(c => c.value === initialPublication?.notesForAI);
    return match ? '' : (initialPublication?.notesForAI || '');
  });

  // Modal Dinâmico: Calendário Aberto Moderno + Select de Hora Moderno
  const [isDateTimeModalOpen, setIsDateTimeModalOpen] = useState<boolean>(false);
  const [tempEventDate, setTempEventDate] = useState<string>(initialPublication?.eventDate || '');
  const [tempEventTime, setTempEventTime] = useState<string>(initialPublication?.eventTime || '');
  
  // Estado do Calendário Aberto
  const [calViewDate, setCalViewDate] = useState<Date>(() => new Date());
  const [selectedDayNum, setSelectedDayNum] = useState<number | null>(null);

  // Estado dos Selects Modernos de Horário
  const [startHour, setStartHour] = useState<string>('08');
  const [startMinute, setStartMinute] = useState<string>('00');
  const [hasEndTime, setHasEndTime] = useState<boolean>(true);
  const [endHour, setEndHour] = useState<string>('17');
  const [endMinute, setEndMinute] = useState<string>('00');

  const updateTimeText = (sH: string, sM: string, hasEnd: boolean, eH: string, eM: string) => {
    if (!sH) {
      setTempEventTime('');
      return;
    }
    const startTimeStr = `${sH}:${sM}`;
    if (hasEnd && eH) {
      const endTimeStr = `${eH}:${eM}`;
      setTempEventTime(`Das ${startTimeStr} às ${endTimeStr}`);
    } else {
      setTempEventTime(`A partir das ${startTimeStr}`);
    }
  };

  const openDateTimeModal = () => {
    setTempEventDate(eventDate);
    setTempEventTime(eventTime);
    
    // Inicia a visualização do calendário no mês de hoje
    const now = new Date();
    setCalViewDate(now);
    
    // Sincroniza dia selecionado caso exista eventDate
    if (eventDate) {
      const matchDay = eventDate.match(/^(\d{1,2})/);
      if (matchDay) {
        setSelectedDayNum(parseInt(matchDay[1], 10));
      } else {
        setSelectedDayNum(null);
      }
    } else {
      setSelectedDayNum(null);
    }

    // Sincroniza selects de horário com o eventTime existente
    if (eventTime) {
      const matchRange = eventTime.match(/(\d{1,2}):(\d{2}).*?(\d{1,2}):(\d{2})/);
      if (matchRange) {
        setStartHour(matchRange[1].padStart(2, '0'));
        setStartMinute(matchRange[2]);
        setHasEndTime(true);
        setEndHour(matchRange[3].padStart(2, '0'));
        setEndMinute(matchRange[4]);
      } else {
        const matchSingle = eventTime.match(/(\d{1,2}):(\d{2})/);
        if (matchSingle) {
          setStartHour(matchSingle[1].padStart(2, '0'));
          setStartMinute(matchSingle[2]);
          setHasEndTime(false);
        }
      }
    } else {
      setStartHour('08');
      setStartMinute('00');
      setHasEndTime(true);
      setEndHour('17');
      setEndMinute('00');
    }

    setIsDateTimeModalOpen(true);
  };

  const applyDateTimeModal = () => {
    setEventDate(tempEventDate.trim());
    setEventTime(tempEventTime.trim());
    setIsDateTimeModalOpen(false);
  };

  const handleSelectDay = (day: number) => {
    setSelectedDayNum(day);
    const year = calViewDate.getFullYear();
    const month = calViewDate.getMonth();
    const formatted = `${day} de ${MONTH_NAMES_PT[month]} de ${year}`;
    setTempEventDate(formatted);
  };

  const handlePrevMonth = () => {
    setCalViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCalViewDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };


  // Preenchimento inteligente por IA
  const [isAutoFilling, setIsAutoFilling] = useState<boolean>(false);
  const [autoFilledFields, setAutoFilledFields] = useState<{
    title?: boolean;
    subtitle?: boolean;
    ctaText?: boolean;
    category?: boolean;
    eventDate?: boolean;
    eventTime?: boolean;
    eventLocation?: boolean;
  }>({
    title: !!initialPublication?.title,
    subtitle: !!initialPublication?.subtitle,
    ctaText: !!initialPublication?.ctaText
  });

  // Imagens do usuário
  const [userImages, setUserImages] = useState<string[]>(initialPublication?.userImages || []);
  const [primaryImageIndex, setPrimaryImageIndex] = useState<number>(initialPublication?.primaryImageIndex || 0);

  // Logos da Prefeitura e Referências
  const [logos, setLogos] = useState<ArtLogoItem[]>([]);
  const [selectedLogoId, setSelectedLogoId] = useState<string>('');
  const [references, setReferences] = useState<ArtReferenceItem[]>([]);

  // Estado da geração por IA
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generationProgressText, setGenerationProgressText] = useState<string>('Iniciando...');
  const [generationStepIndex, setGenerationStepIndex] = useState<number>(1);

  // Resultado da geração
  const [variations, setVariations] = useState<ArtVariation[]>(initialPublication?.variations || []);
  const [selectedVariationIndex, setSelectedVariationIndex] = useState<number>(0);
  const [activeFormat, setActiveFormat] = useState<ArtFormatType>('vertical');
  const [savedPublicationId, setSavedPublicationId] = useState<string | null>(initialPublication?.id || null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadedLogos = artStudioService.getLogos();
    setLogos(loadedLogos);
    const defLogo = artStudioService.getDefaultLogo();
    if (defLogo) setSelectedLogoId(defLogo.id);

    const loadedRefs = artStudioService.getReferences();
    setReferences(loadedRefs);

    // Hidrata logos de forma assíncrona do IndexedDB
    artStudioService.loadLogosAsync().then((asyncLogos) => {
      if (asyncLogos && asyncLogos.length > 0) {
        setLogos(asyncLogos);
        if (!selectedLogoId) {
          const def = asyncLogos.find(l => l.isDefault) || asyncLogos[0];
          if (def) setSelectedLogoId(def.id);
        }
      }
    }).catch(() => {});

    // Hidrata referências de forma assíncrona caso o IndexedDB tenha acabado de abrir
    artStudioService.loadReferencesAsync().then((asyncRefs) => {
      if (asyncRefs && asyncRefs.length > 0) {
        setReferences(asyncRefs);
      }
    }).catch(() => {});

    if (initialPublication?.variations && initialPublication.variations.length > 0) {
      setCurrentStep(3); // vai direto ao resultado se estiver reabrindo
    }
  }, [initialPublication]);

  const selectedLogo = logos.find(l => l.id === selectedLogoId) || logos[0] || null;

  // Função para a IA preencher automaticamente Título, Subtítulo e CTA a partir da descrição
  const handleAutoFillFromDescription = async (descOverride?: string) => {
    const textToProcess = (descOverride !== undefined ? descOverride : description).trim();
    if (!textToProcess || textToProcess.length < 5) return;
    if (isAutoFilling) return;

    setIsAutoFilling(true);
    try {
      const result = await artStudioService.autoFillFieldsFromDescription(textToProcess);
      if (result.title) {
        setTitle(result.title);
      }
      if (result.subtitle) {
        setSubtitle(result.subtitle);
      }
      if (result.ctaText) {
        setCtaText(result.ctaText);
      }
      if (result.category) {
        setCategory(result.category);
      }
      if (result.eventDate && !eventDate) {
        setEventDate(result.eventDate);
      }
      if (result.eventTime && !eventTime) {
        setEventTime(result.eventTime);
      }
      if (result.eventLocation && !eventLocation) {
        setEventLocation(result.eventLocation);
      }

      setAutoFilledFields({
        title: !!result.title,
        subtitle: !!result.subtitle,
        ctaText: !!result.ctaText,
        category: !!result.category,
        eventDate: !!result.eventDate,
        eventTime: !!result.eventTime,
        eventLocation: !!result.eventLocation
      });
    } catch (err) {
      console.error('Erro no auto-fill:', err);
    } finally {
      setIsAutoFilling(false);
    }
  };

  // Avança da Etapa 1 para Etapa 2
  const handleProceedToStep2 = () => {
    if (!title.trim()) {
      alert('Por favor, preencha o campo "Título Principal" da publicação.');
      return;
    }
    setCurrentStep(2);
  };

  const handleUserImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        if (base64) {
          setUserImages(prev => [...prev, base64]);
        }
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeUserImage = (index: number) => {
    setUserImages(prev => prev.filter((_, i) => i !== index));
    if (primaryImageIndex >= index && primaryImageIndex > 0) {
      setPrimaryImageIndex(prev => prev - 1);
    }
  };

  // Executa o motor generativo de IA
  const handleGenerateArt = async () => {
    if (!title.trim() && !description.trim()) {
      alert('Por favor, forneça ao menos as informações da publicação na Etapa 1.');
      setCurrentStep(1);
      return;
    }

    // Se o título estiver em branco, extrai automaticamente
    if (!title.trim() && description.trim()) {
      setTitle(artStudioService.extractFallbackTitle(description));
    }

    setIsGenerating(true);
    setGenerationStepIndex(1);
    setGenerationProgressText('Analisando informações e referências visuais...');

    try {
      const generatedVariations = await artStudioService.generateArtWithAI(
        {
          title,
          subtitle,
          description,
          eventDate,
          eventTime,
          eventLocation,
          category,
          ctaText,
          notesForAI
        },
        userImages,
        references,
        selectedLogo,
        (text, step) => {
          setGenerationProgressText(text);
          setGenerationStepIndex(step);
        }
      );

      setVariations(generatedVariations);
      setSelectedVariationIndex(0);

      // Salva no histórico de publicações
      const pubId = initialPublication?.id || `art_pub_${Date.now()}`;
      const newPublication: ArtPublication = {
        id: pubId,
        title,
        subtitle,
        description,
        eventDate,
        eventTime,
        eventLocation,
        category,
        ctaText,
        notesForAI,
        userImages,
        primaryImageIndex,
        selectedLogoId,
        logoSnapshot: selectedLogo || undefined,
        referencesUsed: references,
        variations: generatedVariations,
        selectedVariationIndex: 0,
        activeFormat: 'vertical',
        createdAt: initialPublication?.createdAt || new Date().toISOString()
      };

      artStudioService.savePublication(newPublication);
      setSavedPublicationId(pubId);

      // Avança para a tela de visualização do resultado (Etapa 3)
      setCurrentStep(3);
    } catch (e) {
      console.error('Erro na geração da arte:', e);
      alert('Ocorreu uma oscilação na IA. Tente novamente.');
    } finally {
      setIsGenerating(false);
    }
  };

  const categories = [
    'Saúde Pública', 'Educação & Ensino', 'Obras & Infraestrutura', 'Cultura & Eventos',
    'Assistência Social', 'Meio Ambiente', 'Esporte & Lazer', 'Governo & Gestão'
  ];

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] w-full overflow-hidden font-sans">
      {/* Barra de Navegação Superior Compacta */}
      <header className="shrink-0 bg-white border-b border-slate-200/90 px-4 md:px-6 py-2.5 flex items-center justify-between z-30 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            type="button"
            className="p-1.5 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-900 hover:text-white transition-all active:scale-95 border border-slate-200/60 cursor-pointer"
            title="Voltar ao Painel"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h1 className="text-base md:text-lg font-black text-slate-900 tracking-tight">
            Criador Inteligente de Artes
          </h1>
        </div>

        {/* Indicador de Etapas Compacto */}
        <div className="hidden sm:flex items-center gap-1.5">
          {[
            { step: 1, label: 'Informações' },
            { step: 2, label: 'Imagens' },
            { step: 3, label: 'Resultado' }
          ].map((s) => (
            <button
              key={s.step}
              type="button"
              onClick={() => {
                if (s.step === 3 && variations.length === 0) return;
                setCurrentStep(s.step);
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                currentStep === s.step
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/20'
                  : currentStep > s.step
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                  : 'bg-slate-100 text-slate-400 border border-slate-200/60'
              }`}
            >
              <span>{s.step}. {s.label}</span>
              {currentStep > s.step && <Check className="w-3 h-3" />}
            </button>
          ))}
        </div>
      </header>

      {/* Conteúdo Principal de Cada Etapa */}
      <main className="flex-1 overflow-y-auto custom-scrollbar p-5 md:p-8">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* ========================================== */}
          {/* ETAPA 1: INFORMAÇÕES DO COMUNICADO         */}
          {/* ========================================== */}
          {currentStep === 1 && (
            <div className="bg-white rounded-3xl border border-slate-200/90 p-6 md:p-8 shadow-sm space-y-7 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-100 gap-4">
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">
                    Etapa 1 — Informações da Publicação
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Preencha as informações da publicação para a criação das artes institucionais.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleProceedToStep2}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-indigo-500/20 cursor-pointer"
                >
                  <span>Próximo: Imagens</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Informações Principais Preenchidas pelo Usuário */}
              <div className="space-y-5">
                {/* Título Principal */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center justify-between">
                    <span>Título Principal *</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Campanha de Vacinação Contra a Gripe"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none text-sm font-bold text-slate-900 placeholder:text-slate-400 transition-all shadow-sm"
                  />
                </div>

                {/* Subtítulo / Chamada Secundária */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center justify-between">
                    <span>Subtítulo / Chamada Secundária</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Proteja sua família comparecendo à Unidade Básica de Saúde mais próxima."
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none text-sm font-medium text-slate-900 placeholder:text-slate-400 transition-all shadow-sm"
                  />
                </div>

                {/* Texto Principal / Descrição Completa */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                      Texto Principal / Descrição Completa
                    </label>
                    {description.trim().length > 0 && (
                      <span className="text-[11px] font-semibold text-indigo-600">
                        {description.trim().length} caracteres
                      </span>
                    )}
                  </div>
                  <textarea
                    rows={4}
                    placeholder="Cole ou digite aqui todas as informações, detalhes e contexto da publicação."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full p-4 rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none text-sm font-medium text-slate-900 placeholder:text-slate-400 shadow-inner resize-y transition-all"
                  />
                </div>
              </div>

              {/* 3. DADOS ESPECÍFICOS DO EVENTO & CATEGORIA */}
              <div className="space-y-4 pt-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                  Dados Opcionais do Evento & Categoria
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-700">
                      Categoria Institucional
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 outline-none text-sm font-bold text-slate-900 cursor-pointer"
                    >
                      {categories.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  {/* Campo Unificado: Data e Horário com Modal Dinâmico */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                        <Clock className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Data e Horário</span>
                        {(autoFilledFields.eventDate || autoFilledFields.eventTime) && (
                          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded">Detectado</span>
                        )}
                      </label>
                      {(eventDate || eventTime) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEventDate('');
                            setEventTime('');
                          }}
                          className="text-[11px] text-slate-400 hover:text-rose-600 font-bold transition-colors cursor-pointer"
                        >
                          Limpar
                        </button>
                      )}
                    </div>

                    <div
                      onClick={openDateTimeModal}
                      className="w-full min-h-[50px] px-4 py-2.5 rounded-2xl bg-white border border-slate-200 hover:border-indigo-500 hover:shadow-md cursor-pointer transition-all flex items-center justify-between group"
                    >
                      {eventDate || eventTime ? (
                        <div className="flex flex-col gap-0.5 text-left py-0.5">
                          {eventDate && (
                            <div className="flex items-center gap-1.5 font-bold text-slate-900 text-xs sm:text-sm">
                              <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                              <span>{eventDate}</span>
                            </div>
                          )}
                          {eventTime && (
                            <div className="flex items-center gap-1.5 font-medium text-slate-600 text-xs">
                              <Clock className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                              <span>{eventTime}</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-slate-400 text-xs sm:text-sm">
                          <Calendar className="w-4 h-4 text-indigo-400 group-hover:text-indigo-600 transition-colors" />
                          <span>Clique para definir Data e Horário...</span>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 group-hover:bg-indigo-600 group-hover:text-white px-3 py-1.5 rounded-xl transition-all shrink-0 ml-2 shadow-sm">
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{eventDate || eventTime ? 'Alterar' : 'Definir'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Local do Evento */}
                  <div className="md:col-span-2 space-y-1.5">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Local do Evento</span>
                      {autoFilledFields.eventLocation && (
                        <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded">Detectado</span>
                      )}
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Praça da Matriz / Unidades Básicas de Saúde / Ginásio Poliesportivo"
                      value={eventLocation}
                      onChange={(e) => setEventLocation(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 outline-none text-sm font-medium text-slate-900 transition-all"
                    />
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Diretriz Estratégica para a IA (Comandos Pré-definidos)</span>
                      </label>
                      <span className="text-[10px] text-indigo-700 font-bold bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 rounded-full">
                        Direção de Arte Direta
                      </span>
                    </div>

                    <select
                      value={selectedCommandPreset}
                      onChange={(e) => {
                        const val = e.target.value;
                        setSelectedCommandPreset(val);
                        if (val === 'custom') {
                          setNotesForAI(customNotes);
                        } else {
                          setNotesForAI(val);
                        }
                      }}
                      className="w-full px-4 py-3 rounded-2xl bg-white border border-indigo-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 outline-none text-sm font-bold text-slate-900 shadow-sm cursor-pointer"
                    >
                      {AI_PRESET_COMMANDS.map((cmd) => (
                        <option key={cmd.value} value={cmd.value}>
                          {cmd.label}
                        </option>
                      ))}
                    </select>

                    {selectedCommandPreset === 'custom' && (
                      <div className="pt-1 animate-fade-in">
                        <input
                          type="text"
                          placeholder="Digite um comando específico de direção de arte para a IA..."
                          value={customNotes}
                          onChange={(e) => {
                            setCustomNotes(e.target.value);
                            setNotesForAI(e.target.value);
                          }}
                          className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-indigo-300 focus:bg-white focus:border-indigo-500 outline-none text-sm font-medium text-slate-900 placeholder:text-slate-400 shadow-inner"
                          autoFocus
                        />
                      </div>
                    )}

                    <p className="text-[11px] text-slate-500">
                      O comando selecionado instrui a IA a direcionar a tipografia, iluminação e contraste para o objetivo da comunicação.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* ETAPA 2: IMAGENS DA PUBLICAÇÃO             */}
          {/* ========================================== */}
          {currentStep === 2 && (
            <div className="bg-white rounded-3xl border border-slate-200/90 p-6 md:p-8 shadow-sm space-y-6 animate-fade-in">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">
                    Etapa 2 — Imagens do Conteúdo
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Envie as fotos relacionadas ao evento ou publicação. A IA aplicará recortes, sobreposições e tratamentos de luz.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="px-4 py-2.5 rounded-2xl bg-slate-100 text-slate-700 hover:bg-slate-200 text-xs font-bold transition-all cursor-pointer"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerateArt}
                    disabled={isGenerating}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-indigo-500/20 active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Gerando com IA...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Gerar Arte com IA</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <input
                type="file"
                ref={fileInputRef}
                onChange={handleUserImageUpload}
                multiple
                accept="image/*"
                className="hidden"
              />

              {/* Botão de Upload com Drag and Drop */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-8 border-2 border-dashed border-indigo-200 hover:border-indigo-500 rounded-3xl bg-indigo-50/30 hover:bg-indigo-50/60 transition-all flex flex-col items-center justify-center text-center cursor-pointer group"
              >
                <div className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30 group-hover:scale-110 transition-transform mb-3">
                  <Upload className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-black text-slate-900">
                  Clique aqui para enviar as fotos da publicação
                </h4>
                <p className="text-xs text-slate-500 mt-1">
                  Suporta JPG, PNG e WebP em alta resolução. Você pode enviar múltiplas imagens.
                </p>
              </div>

              {/* Grid das Imagens Enviadas */}
              {userImages.length > 0 ? (
                <div className="space-y-2">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-700">
                    Imagens Selecionadas ({userImages.length}) — Escolha a foto principal:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {userImages.map((img, idx) => (
                      <div
                        key={idx}
                        className={`h-36 rounded-2xl overflow-hidden relative border-2 transition-all group ${
                          primaryImageIndex === idx ? 'border-indigo-600 ring-4 ring-indigo-500/10' : 'border-slate-200'
                        }`}
                      >
                        <img src={img} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => setPrimaryImageIndex(idx)}
                            className="px-2.5 py-1 rounded-xl bg-white text-indigo-700 font-black text-[10px] uppercase shadow-md cursor-pointer"
                          >
                            Definir Principal
                          </button>
                          <button
                            type="button"
                            onClick={() => removeUserImage(idx)}
                            className="p-1 rounded-xl bg-rose-600 text-white shadow-md cursor-pointer"
                          >
                            ×
                          </button>
                        </div>
                        {primaryImageIndex === idx && (
                          <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-indigo-600 text-white text-[9px] font-black uppercase tracking-wider shadow-sm">
                            Principal
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-2">
                  Nenhuma foto enviada ainda. Se não enviar fotos, a IA criará uma composição gráfica baseada em tipografia de impacto, formas e elementos institucionais.
                </p>
              )}

              {/* Botão de Rodapé para Gerar Arte com IA */}
              <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <span className="text-xs text-slate-500">
                  ✨ A IA aplicará automaticamente suas referências salvas e a logomarca oficial da Prefeitura.
                </span>
                <button
                  type="button"
                  onClick={handleGenerateArt}
                  disabled={isGenerating}
                  className="flex items-center justify-center gap-2 px-7 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-indigo-500/25 active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processando Design com IA...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Gerar Arte com IA</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* ========================================== */}
          {/* ETAPA 3: RESULTADO, VARIAÇÕES E EXPORTAÇÃO */}
          {/* ========================================== */}
          {currentStep === 3 && variations.length > 0 && (
            <div className="space-y-6 animate-fade-in">
              {/* Barra de Controle do Resultado */}
              <div className="bg-white rounded-3xl border border-slate-200/90 p-5 md:p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-2xl shadow-md shadow-indigo-500/20">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-lg md:text-xl font-black text-slate-900 tracking-tight">
                      {title || 'Arte Gerada'}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      3 propostas visuais geradas pela IA adaptadas individualmente para Feed e Stories.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-wrap">
                  {/* Seletor de Formato */}
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setActiveFormat('vertical')}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                        activeFormat === 'vertical' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      1080 × 1920 (Stories)
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveFormat('quadrado')}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                        activeFormat === 'quadrado' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      1080 × 1080 (Feed)
                    </button>
                  </div>

                  {/* Troca de Logo Instantânea sem Refazer a Arte (Regra 8) */}
                  <div className="flex items-center gap-1.5 bg-indigo-50/70 p-1.5 rounded-2xl border border-indigo-100">
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 pl-1.5">
                      Logo:
                    </span>
                    <select
                      value={selectedLogoId || ''}
                      onChange={(e) => {
                        const newId = e.target.value;
                        setSelectedLogoId(newId);
                        if (savedPublicationId) {
                          const newLogo = logos.find(l => l.id === newId);
                          artStudioService.updatePublication(savedPublicationId, {
                            selectedLogoId: newId,
                            logoSnapshot: newLogo || undefined
                          });
                        }
                      }}
                      className="bg-white px-2.5 py-1 rounded-xl text-xs font-bold text-slate-800 border border-indigo-200/80 outline-none cursor-pointer shadow-2xs hover:border-indigo-500"
                      title="Trocar a Logo Oficial instantaneamente sem refazer a arte"
                    >
                      {logos.map(l => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </div>

                  {savedPublicationId && onEditPublication && (
                    <button
                      type="button"
                      onClick={() => onEditPublication(savedPublicationId)}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider transition-all shadow-md cursor-pointer"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Abrir no Editor</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setCurrentStep(1)}
                    className="px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
                  >
                    Editar Dados
                  </button>
                </div>
              </div>

              {/* Seletor das 3 Variações */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {variations.map((v, idx) => (
                  <div
                    key={v.id || idx}
                    onClick={() => setSelectedVariationIndex(idx)}
                    className={`p-4 rounded-3xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                      selectedVariationIndex === idx
                        ? 'border-indigo-600 bg-white shadow-md ring-4 ring-indigo-500/10'
                        : 'border-slate-200 bg-white/70 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-black uppercase tracking-wider text-indigo-700">
                          {v.styleName}
                        </span>
                        {selectedVariationIndex === idx && (
                          <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[9px] font-black uppercase">
                            Selecionada
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                        {v.description}
                      </p>
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400">Paleta:</span>
                      <div className="w-4 h-4 rounded-full border shadow-2xs" style={{ background: v.primaryColor }} />
                      <div className="w-4 h-4 rounded-full border shadow-2xs" style={{ background: v.secondaryColor }} />
                      <div className="w-4 h-4 rounded-full border shadow-2xs" style={{ background: v.accentColor }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Renderizador Visual da Arte Selecionada */}
              <div className="bg-white rounded-3xl border border-slate-200/90 p-6 md:p-8 shadow-sm flex flex-col items-center">
                <ArtCanvasRenderer
                  publication={{
                    title,
                    subtitle,
                    description,
                    eventDate,
                    eventTime,
                    eventLocation,
                    category,
                    ctaText
                  }}
                  variation={variations[selectedVariationIndex]}
                  format={activeFormat}
                  logo={selectedLogo}
                  primaryImage={userImages[primaryImageIndex] || null}
                  interactiveScale={true}
                  className="w-full flex items-center justify-center"
                />
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modal Imersivo durante o Progresso da Geração com IA */}
      {isGenerating && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl space-y-6">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center mx-auto shadow-xl shadow-indigo-500/30 animate-pulse">
              <Sparkles className="w-8 h-8 animate-spin-slow" />
            </div>

            <div>
              <h3 className="text-xl font-black text-white tracking-tight">
                Estúdio de IA em Ação
              </h3>
              <p className="text-xs text-indigo-300 mt-1 font-semibold">
                Etapa {generationStepIndex} de 10
              </p>
            </div>

            {/* Barra de Progresso */}
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700/60">
              <div 
                className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500 rounded-full"
                style={{ width: `${(generationStepIndex / 10) * 100}%` }}
              />
            </div>

            <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/50 text-slate-200 text-sm font-bold min-h-[56px] flex items-center justify-center">
              <span>{generationProgressText}</span>
            </div>
          </div>
        </div>
      )}

      {/* Modal Aberto, Moderno e Bonito: Calendário Visual Interativo + Selects Modernos de Horário */}
      {isDateTimeModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-scale-up">
            {/* Cabeçalho */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">
                    Definir Data e Horário
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Selecione o dia no calendário e o horário do evento
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsDateTimeModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white border border-slate-200 hover:bg-slate-100 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Conteúdo: Calendário Aberto + Selects Modernos */}
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                {/* 1. Coluna Esquerda: Calendário Aberto Interativo (7 colunas) */}
                <div className="md:col-span-7 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Calendário</span>
                    </label>

                    {/* Navegação do Mês / Ano */}
                    <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl border border-slate-200/60">
                      <button
                        type="button"
                        onClick={handlePrevMonth}
                        className="w-7 h-7 rounded-lg hover:bg-white text-slate-600 hover:text-indigo-600 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                        title="Mês anterior"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-xs font-black text-slate-800 px-2 min-w-[120px] text-center">
                        {MONTH_NAMES_PT[calViewDate.getMonth()]} {calViewDate.getFullYear()}
                      </span>
                      <button
                        type="button"
                        onClick={handleNextMonth}
                        className="w-7 h-7 rounded-lg hover:bg-white text-slate-600 hover:text-indigo-600 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                        title="Próximo mês"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Grade Aberta do Calendário */}
                  <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-xs">
                    {/* Cabeçalho dos Dias da Semana */}
                    <div className="grid grid-cols-7 gap-1 text-center mb-2">
                      {WEEKDAYS_SHORT_PT.map((d, i) => (
                        <span key={i} className="text-[10px] font-black uppercase tracking-wider text-slate-400 py-1">
                          {d}
                        </span>
                      ))}
                    </div>

                    {/* Dias do Mês */}
                    {(() => {
                      const year = calViewDate.getFullYear();
                      const month = calViewDate.getMonth();
                      const daysInMonth = new Date(year, month + 1, 0).getDate();
                      const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Dom
                      const today = new Date();
                      const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

                      return (
                        <div className="grid grid-cols-7 gap-1">
                          {/* Espaços vazios do início */}
                          {Array.from({ length: firstDayIndex }).map((_, i) => (
                            <div key={`empty-${i}`} className="h-9 w-full" />
                          ))}

                          {/* Botões dos dias */}
                          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                            const isSelected = selectedDayNum === day;
                            const isToday = isCurrentMonth && today.getDate() === day;

                            return (
                              <button
                                key={day}
                                type="button"
                                onClick={() => handleSelectDay(day)}
                                className={`h-9 w-full rounded-xl flex items-center justify-center text-xs font-bold transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white font-black shadow-md shadow-indigo-500/30 scale-105 ring-2 ring-indigo-300'
                                    : isToday
                                    ? 'border border-indigo-400/60 bg-indigo-50/70 text-indigo-700 hover:bg-indigo-100 font-black'
                                    : 'text-slate-700 hover:bg-slate-200/80 hover:text-slate-900'
                                }`}
                              >
                                {day}
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* 2. Coluna Direita: Selects Modernos de Horário (5 colunas) */}
                <div className="md:col-span-5 space-y-4 flex flex-col justify-start">
                  <div className="space-y-3">
                    <label className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Horário do Evento</span>
                    </label>

                    {/* Selects de Início */}
                    <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                        Horário de Início
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase">Hora</label>
                          <select
                            value={startHour}
                            onChange={(e) => {
                              setStartHour(e.target.value);
                              updateTimeText(e.target.value, startMinute, hasEndTime, endHour, endMinute);
                            }}
                            className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
                          >
                            {HOURS_LIST.map((h) => (
                              <option key={h} value={h}>{h}h</option>
                            ))}
                          </select>
                        </div>
                        <span className="text-slate-400 font-black mt-3">:</span>
                        <div className="flex-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase">Minuto</label>
                          <select
                            value={startMinute}
                            onChange={(e) => {
                              setStartMinute(e.target.value);
                              updateTimeText(startHour, e.target.value, hasEndTime, endHour, endMinute);
                            }}
                            className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
                          >
                            {MINUTES_LIST.map((m) => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Checkbox / Toggle Término */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={hasEndTime}
                            onChange={(e) => {
                              setHasEndTime(e.target.checked);
                              updateTimeText(startHour, startMinute, e.target.checked, endHour, endMinute);
                            }}
                            className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                          />
                          <span className="text-xs font-bold text-slate-700">Adicionar horário de término</span>
                        </label>
                      </div>

                      {hasEndTime && (
                        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 animate-fade-in">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                            Horário de Término
                          </span>
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <label className="text-[9px] font-bold text-slate-400 uppercase">Hora</label>
                              <select
                                value={endHour}
                                onChange={(e) => {
                                  setEndHour(e.target.value);
                                  updateTimeText(startHour, startMinute, true, e.target.value, endMinute);
                                }}
                                className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
                              >
                                {HOURS_LIST.map((h) => (
                                  <option key={h} value={h}>{h}h</option>
                                ))}
                              </select>
                            </div>
                            <span className="text-slate-400 font-black mt-3">:</span>
                            <div className="flex-1">
                              <label className="text-[9px] font-bold text-slate-400 uppercase">Minuto</label>
                              <select
                                value={endMinute}
                                onChange={(e) => {
                                  setEndMinute(e.target.value);
                                  updateTimeText(startHour, startMinute, true, endHour, e.target.value);
                                }}
                                className="w-full px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 outline-none focus:border-indigo-500 cursor-pointer shadow-2xs"
                              >
                                {MINUTES_LIST.map((m) => (
                                  <option key={m} value={m}>{m}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Rodapé */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => {
                  setTempEventDate('');
                  setTempEventTime('');
                  setSelectedDayNum(null);
                }}
                className="text-xs font-bold text-slate-400 hover:text-rose-600 transition-colors px-2 py-1 cursor-pointer"
              >
                Limpar
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsDateTimeModalOpen(false)}
                  className="px-4 py-2 rounded-2xl bg-white border border-slate-200 hover:bg-slate-100 text-xs font-bold text-slate-700 transition-all cursor-pointer shadow-2xs"
                >
                  Cancelar
                </button>

                <button
                  type="button"
                  onClick={applyDateTimeModal}
                  className="flex items-center gap-1.5 px-6 py-2.5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white text-xs font-black shadow-md shadow-indigo-500/25 transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Confirmar Data e Horário</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
