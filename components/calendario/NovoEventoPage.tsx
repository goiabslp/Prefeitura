import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowLeft,
  Calendar as CalendarIcon,
  Save,
  Trash2,
  Loader2,
  Users,
  CheckSquare,
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Clock,
  Sparkles,
  Newspaper,
  Camera,
  CheckCircle2,
  Wand2,
  Gift,
  Repeat,
  Search,
  X,
  FileText,
  Layers,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Flag
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../services/supabaseClient';
import { calendarService, CalendarEvent } from '../../services/calendarService';
import { getPersons, getSectors, getJobs } from '../../services/entityService';
import { getLocalISOData } from '../../utils/dateUtils';
import { Person, Sector, Job, JornalMateria } from '../../types';
import { noticiasService } from '../../services/noticiasService';
import { generateMateriaJornalWithAI, GeneratedMateriaJornal } from '../../services/geminiService';

interface NovoEventoPageProps {
  onBack: () => void;
  onSaved: () => void;
  eventToEdit: CalendarEvent | null;
  selectedDate: string; // YYYY-MM-DD
  currentUserId: string;
}

interface UserProfile {
  id: string;
  name: string;
}

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];
const WEEK_DAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

/**
 * Calendário em Formato de Modal em Tela
 */
const DatePickerModal: React.FC<{
  title: string;
  selectedDate: string;
  onSelectDate: (dateStr: string) => void;
  onClose: () => void;
  minDate?: string;
}> = ({ title, selectedDate, onSelectDate, onClose, minDate }) => {
  const initialDate = selectedDate ? new Date(selectedDate + 'T12:00:00') : new Date();
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());
  const [tempSelectedDate, setTempSelectedDate] = useState(selectedDate || getLocalISOData(new Date()).date);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(viewYear, viewMonth, 1).getDay();

  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();
  const prevMonthDays = [];
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    prevMonthDays.push(daysInPrevMonth - i);
  }

  const todayStr = getLocalISOData(new Date()).date;

  // Formatação por extenso da data temporária selecionada
  const formattedDateExtended = useMemo(() => {
    if (!tempSelectedDate) return '';
    const [y, m, d] = tempSelectedDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    return dateObj.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  }, [tempSelectedDate]);

  return (
    <div className="fixed inset-0 z-[3600] flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-md animate-fade-in font-sans">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.15 }}
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 p-5 sm:p-6 w-full max-w-md select-none flex flex-col gap-3.5"
        onClick={e => e.stopPropagation()}
      >
        {/* Header do Modal */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white flex items-center justify-center shadow-xs">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">{title}</h3>
              <p className="text-[11px] text-indigo-600 font-bold capitalize truncate max-w-[240px]">
                {formattedDateExtended || 'Selecione uma data'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center font-black cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Barra de Navegação do Mês e Ano */}
        <div className="flex items-center justify-between px-1 bg-slate-50 p-2 rounded-2xl border border-slate-100">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="w-8 h-8 rounded-xl hover:bg-white text-slate-700 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <div className="text-xs sm:text-sm font-black text-slate-900 tracking-tight">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </div>

          <button
            type="button"
            onClick={handleNextMonth}
            className="w-8 h-8 rounded-xl hover:bg-white text-slate-700 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Cabeçalho dos Dias da Semana */}
        <div className="grid grid-cols-7 gap-1 pt-1 text-center">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((d, i) => (
            <span key={i} className={`text-[10px] font-black uppercase ${i === 0 || i === 6 ? 'text-rose-500' : 'text-slate-400'}`}>
              {d}
            </span>
          ))}
        </div>

        {/* Grade de Dias do Mês */}
        <div className="grid grid-cols-7 gap-1.5 text-center">
          {prevMonthDays.map((d, i) => (
            <div key={`prev-${i}`} className="h-9 flex items-center justify-center text-xs text-slate-300 font-medium">
              {d}
            </div>
          ))}

          {Array.from({ length: daysInMonth }).map((_, idx) => {
            const dayNum = idx + 1;
            const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const isSelected = tempSelectedDate === dateStr;
            const isToday = todayStr === dateStr;
            const isDisabled = minDate && dateStr < minDate;

            return (
              <button
                key={dayNum}
                type="button"
                disabled={Boolean(isDisabled)}
                onClick={() => setTempSelectedDate(dateStr)}
                className={`h-9 w-9 mx-auto rounded-xl text-xs font-black transition-all flex items-center justify-center cursor-pointer ${
                  isSelected
                    ? 'bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white shadow-md shadow-indigo-500/30 scale-105 ring-2 ring-indigo-500/30'
                    : isToday
                    ? 'bg-indigo-50 text-indigo-700 font-black border border-indigo-200 hover:bg-indigo-100'
                    : isDisabled
                    ? 'text-slate-300 opacity-40 cursor-not-allowed'
                    : 'text-slate-700 hover:bg-slate-100 active:scale-95'
                }`}
              >
                {dayNum}
              </button>
            );
          })}
        </div>

        {/* Atalhos Rápidos */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1.5 justify-center">
          <button
            type="button"
            onClick={() => {
              setTempSelectedDate(todayStr);
              const now = new Date();
              setViewYear(now.getFullYear());
              setViewMonth(now.getMonth());
            }}
            className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 cursor-pointer transition-colors"
          >
            Hoje
          </button>

          <button
            type="button"
            onClick={() => {
              const tom = new Date();
              tom.setDate(tom.getDate() + 1);
              const tomStr = getLocalISOData(tom).date;
              setTempSelectedDate(tomStr);
              setViewYear(tom.getFullYear());
              setViewMonth(tom.getMonth());
            }}
            className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer transition-colors"
          >
            Amanhã
          </button>

          <button
            type="button"
            onClick={() => {
              const nextWeek = new Date();
              nextWeek.setDate(nextWeek.getDate() + 7);
              const nextWeekStr = getLocalISOData(nextWeek).date;
              setTempSelectedDate(nextWeekStr);
              setViewYear(nextWeek.getFullYear());
              setViewMonth(nextWeek.getMonth());
            }}
            className="px-2.5 py-1 text-[10px] font-bold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer transition-colors"
          >
            +7 Dias
          </button>
        </div>

        {/* Rodapé de Confirmação */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl cursor-pointer transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={() => {
              onSelectDate(tempSelectedDate);
              onClose();
            }}
            className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white rounded-xl text-xs font-black cursor-pointer transition-all shadow-md shadow-indigo-500/20 active:scale-95"
          >
            Confirmar Data
          </button>
        </div>
      </motion.div>
    </div>
  );
};

const EVENT_TYPES = [
  { value: 'Notícia', label: 'Notícia', color: 'text-sky-600', bg: 'bg-sky-50', active: 'bg-sky-600 text-white border-sky-600', icon: Newspaper },
  { value: 'Pessoal', label: 'Pessoal', color: 'text-amber-600', bg: 'bg-amber-50', active: 'bg-amber-600 text-white border-amber-600', icon: CalendarIcon },
  { value: 'Reunião', label: 'Reunião', color: 'text-indigo-600', bg: 'bg-indigo-50', active: 'bg-indigo-600 text-white border-indigo-600', icon: Users },
  { value: 'Evento', label: 'Evento', color: 'text-emerald-600', bg: 'bg-emerald-50', active: 'bg-emerald-600 text-white border-emerald-600', icon: Flag },
  { value: 'Aniversário', label: 'Aniversário', color: 'text-pink-600', bg: 'bg-pink-50', active: 'bg-pink-600 text-white border-pink-600', icon: Gift },
  { value: 'Feriado Municipal', label: 'Feriado Mun.', color: 'text-rose-600', bg: 'bg-rose-50', active: 'bg-rose-600 text-white border-rose-600', icon: Flag },
  { value: 'Feriado Geral', label: 'Feriado Geral', color: 'text-purple-600', bg: 'bg-purple-50', active: 'bg-purple-600 text-white border-purple-600', icon: Flag }
];

type StepKey = 'identificacao' | 'setor' | 'programacao' | 'jornal';

const STEPS: { key: StepKey; label: string; description: string; icon: any; routePath: string }[] = [
  {
    key: 'identificacao',
    label: '1. Identificação & Tipo',
    description: 'Título e Categoria do Registro',
    icon: CalendarDays,
    routePath: '/Calendario/Novo/Identificacao'
  },
  {
    key: 'setor',
    label: '2. Setor & Servidores',
    description: 'Setor Municipal e Pessoas Envolvidas',
    icon: Building2,
    routePath: '/Calendario/Novo/Setor'
  },
  {
    key: 'programacao',
    label: '3. Programação & Datas',
    description: 'Datas, Horários e Recorrência',
    icon: Clock,
    routePath: '/Calendario/Novo/Programacao'
  },
  {
    key: 'jornal',
    label: '4. Pauta & Jornal (IA)',
    description: 'Foto, Diretrizes e Notícia',
    icon: Newspaper,
    routePath: '/Calendario/Novo/Jornal'
  }
];

export const NovoEventoPage: React.FC<NovoEventoPageProps> = ({
  onBack,
  onSaved,
  eventToEdit,
  selectedDate,
  currentUserId
}) => {
  const [currentStep, setCurrentStep] = useState<StepKey>('identificacao');
  const [title, setTitle] = useState('');
  const [type, setType] = useState('Pessoal');
  const [sector, setSector] = useState('');
  const [sectorId, setSectorId] = useState('');
  const [sectorSearch, setSectorSearch] = useState('');
  // 🏛️ Setores e Pessoas Vinculadas
  const [selectedSectorIds, setSelectedSectorIds] = useState<string[]>([]);
  const [showSectorModal, setShowSectorModal] = useState(false);
  const [showPersonsModal, setShowPersonsModal] = useState(false);
  const [sectorSearchInModal, setSectorSearchInModal] = useState('');
  const [personSearchInModal, setPersonSearchInModal] = useState('');
  const [personSectorFilterInModal, setPersonSectorFilterInModal] = useState<string>('todos');

  const [sectorsList, setSectorsList] = useState<Sector[]>([]);
  const [jobsList, setJobsList] = useState<Job[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [isAllDay, setIsAllDay] = useState(true);
  const [isIndefinite, setIsIndefinite] = useState(false);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('17:00');
  const [description, setDescription] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 📰 Imagem e Publicação no Jornal
  const [imageUrl, setImageUrl] = useState<string>('');
  const [publishToNews, setPublishToNews] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiPreview, setAiPreview] = useState<GeneratedMateriaJornal | null>(null);
  const [showAiPreviewModal, setShowAiPreviewModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Pessoas Envolvidas e Convidados
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [selectedPersonIds, setSelectedPersonIds] = useState<string[]>([]);
  const [professionalId, setProfessionalId] = useState('');
  const [personSearch, setPersonSearch] = useState('');
  const [showPersonDropdown, setShowPersonDropdown] = useState(false);
  const [selectedInvites, setSelectedInvites] = useState<{ user_id: string; role: 'Colaborador' | 'Participante' }[]>([]);

  // Refs de clique fora
  const personBirthDropdownRef = useRef<HTMLDivElement>(null);
  const startDatePickerRef = useRef<HTMLDivElement>(null);
  const endDatePickerRef = useRef<HTMLDivElement>(null);

  // Nomes de setores calculados
  const selectedSectorNames = useMemo(() => {
    return sectorsList.filter(s => selectedSectorIds.includes(s.id)).map(s => s.name);
  }, [sectorsList, selectedSectorIds]);

  const primarySectorName = useMemo(() => {
    return selectedSectorNames.join(', ');
  }, [selectedSectorNames]);

  // Sincronização da Rota URL ao mudar de aba
  const navigateToStep = (step: StepKey) => {
    setCurrentStep(step);
    const stepObj = STEPS.find(s => s.key === step);
    if (stepObj) {
      const baseRoute = eventToEdit ? `/Calendario/Editar/${eventToEdit.id}` : '/Calendario/Novo';
      const targetUrl = `${baseRoute}/${step.charAt(0).toUpperCase() + step.slice(1)}`;
      window.history.pushState({ step }, '', targetUrl);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (personBirthDropdownRef.current && !personBirthDropdownRef.current.contains(target)) {
        setShowPersonDropdown(false);
      }
      if (startDatePickerRef.current && !startDatePickerRef.current.contains(target)) {
        setShowStartDatePicker(false);
      }
      if (endDatePickerRef.current && !endDatePickerRef.current.contains(target)) {
        setShowEndDatePicker(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Inicialização inicial e carregamento de entidades
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [usersRes, sectorsData, jobsData, personsData] = await Promise.all([
          supabase.from('profiles').select('id, name').order('name'),
          getSectors(),
          getJobs(),
          getPersons()
        ]);

        if (usersRes.data) setAllUsers(usersRes.data);
        if (sectorsData) setSectorsList(sectorsData);
        if (jobsData) setJobsList(jobsData);
        if (personsData) setPersons(personsData);

        if (eventToEdit) {
          setTitle(eventToEdit.title);
          setType(eventToEdit.type || 'Pessoal');
          
          // Inicializar múltiplos setores
          const initialSectorIds: string[] = [];
          if (eventToEdit.sector_id) {
            initialSectorIds.push(eventToEdit.sector_id);
          }
          if (eventToEdit.sector && sectorsData) {
            const rawSectors = eventToEdit.sector.split(',').map(s => s.trim().toLowerCase());
            sectorsData.forEach(s => {
              if (rawSectors.includes(s.name.toLowerCase()) && !initialSectorIds.includes(s.id)) {
                initialSectorIds.push(s.id);
              }
            });
          }
          setSelectedSectorIds(initialSectorIds);

          setSelectedPersonIds(eventToEdit.person_ids || []);
          setStartDate(eventToEdit.start_date || selectedDate);
          setEndDate(eventToEdit.end_date || eventToEdit.start_date || selectedDate);
          setIsAllDay(eventToEdit.is_all_day !== false);
          setIsIndefinite(Boolean(eventToEdit.is_indefinite));
          setStartTime(eventToEdit.start_time || '08:00');
          setEndTime(eventToEdit.end_time || '17:00');
          setDescription(eventToEdit.description || '');
          setIsRecurring(Boolean(eventToEdit.is_recurring));
          setImageUrl(eventToEdit.image_url || '');
          setPublishToNews(Boolean(eventToEdit.publish_to_news));
          setProfessionalId(eventToEdit.professional_id || '');

          if (eventToEdit.invites && eventToEdit.invites.length > 0) {
            setSelectedInvites(eventToEdit.invites.map(i => ({ user_id: i.user_id, role: i.role })));
          }
        } else {
          setStartDate(selectedDate || getLocalISOData(new Date()).date);
          setEndDate(selectedDate || getLocalISOData(new Date()).date);
        }
      } catch (err) {
        console.error('Erro ao inicializar página de evento:', err);
      }
    };

    fetchInitialData();
    const baseRoute = eventToEdit ? `/Calendario/Editar/${eventToEdit.id}` : '/Calendario/Novo';
    window.history.pushState({ step: 'identificacao' }, '', `${baseRoute}/Identificacao`);
  }, []);

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setImageUrl(reader.result);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Erro ao processar imagem:', err);
    }
  };

  // Obtenção de dados enriquecidos das pessoas envolvidas para envio à IA e salvamento
  const getPessoasEnvolvidasData = () => {
    return selectedPersonIds.map(id => {
      const p = persons.find(person => person.id === id);
      const j = jobsList.find(job => job.id === p?.jobId);
      const s = sectorsList.find(sec => sec.id === p?.sectorId);
      return {
        id,
        name: p?.name || '',
        jobName: j?.name || p?.role || '',
        role: j?.name || p?.role || '',
        sectorName: s?.name || primarySectorName || '',
        sector: s?.name || primarySectorName || ''
      };
    }).filter(p => p.name);
  };

  const handleGeneratePreviewAI = async () => {
    if (!title.trim()) {
      setErrorMessage('Preencha o título do evento antes de gerar a prévia com IA.');
      return;
    }

    setIsGeneratingAI(true);
    setErrorMessage(null);

    try {
      const pessoasParaIA = getPessoasEnvolvidasData();
      const generated = await generateMateriaJornalWithAI({
        titulo: title,
        tipoEvento: type,
        dataInicio: startDate,
        dataFim: endDate,
        horaInicio: isAllDay ? undefined : startTime,
        horaFim: isAllDay ? undefined : endTime,
        descricao: description,
        setor: primarySectorName,
        pessoas: pessoasParaIA
      });

      setAiPreview(generated);
      setShowAiPreviewModal(true);
    } catch (err: any) {
      console.error('Erro ao gerar prévia:', err);
      setErrorMessage(err.message || 'Não foi possível gerar a matéria com IA no momento.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setErrorMessage('O título do registro é obrigatório.');
      setCurrentStep('identificacao');
      return;
    }

    if (publishToNews && !imageUrl) {
      setErrorMessage('Para publicar no Jornal, a foto oficial é obrigatória.');
      setCurrentStep('jornal');
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const pessoasParaIA = getPessoasEnvolvidasData();
      const finalEndDate = isIndefinite ? startDate : (endDate || startDate);

      let finalMateriaData = aiPreview;
      if (publishToNews && !finalMateriaData) {
        try {
          finalMateriaData = await generateMateriaJornalWithAI({
            titulo: title,
            tipoEvento: type,
            dataInicio: startDate,
            dataFim: endDate,
            horaInicio: isAllDay ? undefined : startTime,
            horaFim: isAllDay ? undefined : endTime,
            descricao: description,
            setor: primarySectorName,
            pessoas: pessoasParaIA
          });
        } catch (aiErr) {
          console.warn('Fallback editorial para jornal:', aiErr);
        }
      }

      const payload: Partial<CalendarEvent> = {
        title,
        type,
        start_date: startDate,
        end_date: finalEndDate,
        is_all_day: isAllDay,
        start_time: isAllDay ? undefined : startTime,
        end_time: (isAllDay || isIndefinite) ? undefined : endTime,
        description: isIndefinite ? `${description ? `${description}\n` : ''}[Tempo Indeterminado]` : description,
        created_by: currentUserId,
        is_recurring: (type === 'Aniversário' || type === 'Feriado Municipal') ? true : isRecurring,
        professional_id: type === 'Aniversário' ? (professionalId || undefined) : undefined,
        image_url: imageUrl || undefined,
        is_indefinite: isIndefinite,
        sector: primarySectorName || undefined,
        sector_id: selectedSectorIds[0] || undefined,
        person_ids: selectedPersonIds,
        persons_involved: pessoasParaIA,
        publish_to_news: publishToNews,
        materia_data: finalMateriaData ? {
          manchete: finalMateriaData.manchete,
          subtitulo: finalMateriaData.subtitulo,
          corpo: finalMateriaData.corpo,
          destaqueFrase: finalMateriaData.destaqueFrase,
          categoria: finalMateriaData.categoria,
          imagemUrl: imageUrl || undefined,
          aprovada: eventToEdit ? (eventToEdit as any).materia_data?.aprovada ?? false : false,
          status: eventToEdit ? (eventToEdit as any).materia_data?.status ?? 'pendente' : 'pendente'
        } : undefined
      };

      let savedEventId = eventToEdit?.id;

      if (eventToEdit) {
        await calendarService.updateEvent(eventToEdit.id, payload);
      } else {
        const invites = selectedInvites.map(inv => ({
          user_id: inv.user_id,
          role: inv.role
        }));
        const res = await calendarService.createEventWithInvites(payload, invites);
        if (!res.success) {
          throw new Error(res.error || 'Erro ao criar evento');
        }
        savedEventId = res.id;
      }

      if (publishToNews && finalMateriaData && savedEventId) {
        const novaMateria: JornalMateria = {
          id: `materia_evt_${savedEventId}`,
          titulo: finalMateriaData.manchete,
          subtitulo: finalMateriaData.subtitulo,
          conteudo: finalMateriaData.corpo,
          categoria: finalMateriaData.categoria,
          dataPublicacao: new Date().toISOString(),
          dataEvento: startDate,
          horaEvento: isAllDay ? 'Dia Inteiro' : `${startTime} às ${endTime}`,
          imagemUrl: imageUrl || undefined,
          autor: 'Assessoria de Comunicação Oficial',
          destaqueFrase: finalMateriaData.destaqueFrase,
          eventoId: savedEventId,
          tipoEvento: type,
          setor: primarySectorName || undefined,
          setorId: sectorId || undefined,
          person_ids: selectedPersonIds,
          pessoasEnvolvidas: pessoasParaIA,
          oculta: false,
          aprovada: false, // Fica pendente de aprovação de administrador
          status: 'pendente',
          curtidas: 1
        };

        await noticiasService.salvarMateria(novaMateria);
      }

      window.history.pushState({}, '', '/Calendario');
      onSaved();
    } catch (err: any) {
      console.error('Erro ao salvar evento:', err);
      setErrorMessage(err.message || 'Erro ao salvar registro.');
    } finally {
      setLoading(false);
    }
  };

  const handleBackToCalendar = () => {
    window.history.pushState({}, '', '/Calendario');
    onBack();
  };

  return (
    <div className="flex-1 flex flex-col h-full max-h-screen bg-slate-100 font-sans overflow-hidden select-none">
      
      {/* HEADER DA PÁGINA COMPACTO (SEM ROLAGEM) */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-5 lg:px-8 py-2.5 border-b border-white/10 shadow-sm shrink-0">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={handleBackToCalendar}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/15 flex items-center justify-center text-slate-200 hover:text-white transition-all cursor-pointer shadow-sm shrink-0"
              title="Voltar ao Calendário"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-white tracking-tight truncate">
                  {eventToEdit ? 'Editar Registro no Calendário' : 'Novo Registro no Calendário'}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/30 text-indigo-200 text-[10px] font-black uppercase tracking-wider border border-indigo-400/30 shrink-0">
                  {type}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-medium truncate">
                Prefeitura Municipal • Gestão Integrada de Agenda, Entidades & Notícias Oficiais
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleBackToCalendar}
              className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-slate-300 hover:text-white text-xs font-bold transition-all cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="px-5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black transition-all flex items-center gap-1.5 shadow-md shadow-emerald-600/30 cursor-pointer active:scale-95 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>{eventToEdit ? 'Salvar Alterações' : 'Salvar Registro'}</span>
            </button>
          </div>

        </div>
      </div>

      {/* ESTEIRA DE ABAS COMPACTA (STEPPER HORIZONTAL COM ROTAS URL) */}
      <div className="bg-white border-b border-slate-200 shadow-2xs shrink-0 px-5 lg:px-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between overflow-x-auto custom-scrollbar">
          {STEPS.map((s) => {
            const Icon = s.icon;
            const isActive = currentStep === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => navigateToStep(s.key)}
                className={`py-2 px-3 border-b-2 flex items-center gap-2.5 transition-all cursor-pointer whitespace-nowrap shrink-0 group ${
                  isActive
                    ? 'border-indigo-600 text-indigo-950 font-black bg-indigo-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300 font-bold'
                }`}
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'
                }`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <div className="text-left">
                  <p className="text-xs tracking-tight">{s.label}</p>
                  <p className="text-[9px] text-slate-400 font-medium hidden sm:block">{s.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ÁREA DE CONTEÚDO 100% AJUSTADA AO VIEWPORT (SEM ROLAGEM) */}
      <div className="flex-1 p-3 sm:p-4 lg:p-5 flex flex-col justify-between overflow-hidden max-w-6xl w-full mx-auto">
        
        {/* Banner de Erro Flutuante */}
        {errorMessage && (
          <div className="mb-2 p-2.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-bold flex items-center justify-between shadow-xs animate-in fade-in shrink-0">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-rose-700 font-black cursor-pointer">✕</button>
          </div>
        )}

        {/* ============================================================= */}
        {/* ABA 1: IDENTIFICAÇÃO & TIPO */}
        {/* ============================================================= */}
        {currentStep === 'identificacao' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-4 sm:p-5 lg:p-6 border border-slate-200 shadow-sm flex-1 flex flex-col justify-between overflow-hidden gap-3"
          >
            {/* Header da Aba */}
            <div className="border-b border-slate-100 pb-2 shrink-0">
              <h2 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight">
                Identificação & Categoria do Registro
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Defina o título principal do evento e selecione a categoria institucional correspondente.
              </p>
            </div>

            {/* Conteúdo Central */}
            <div className="flex-1 flex flex-col justify-around gap-3 overflow-hidden">
              
              {/* Título do Registro em Linha Exclusiva */}
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 block">
                  Título do Registro <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Ex: Inauguração da Nova Unidade Básica de Saúde Central"
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-900 font-bold placeholder:text-slate-400 outline-none text-sm sm:text-base shadow-2xs"
                />
              </div>

              {/* Seletor Compacto de Tipos de Registro */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase tracking-wider text-slate-700 block">
                  Tipo de Registro Institucional
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                  {EVENT_TYPES.map(opt => {
                    const Icon = opt.icon;
                    const isSelected = type === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => {
                          setType(opt.value);
                          if (opt.value === 'Notícia') setPublishToNews(true);
                        }}
                        className={`py-3 px-2 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 cursor-pointer active:scale-95 select-none ${
                          isSelected
                            ? `${opt.active} shadow-xs font-black ring-2 ring-indigo-500/20`
                            : 'bg-slate-50 hover:bg-white text-slate-700 border-slate-200 shadow-2xs'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-white/20 text-white' : `${opt.bg} ${opt.color}`
                        }`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <span className="text-xs font-bold leading-tight truncate w-full">
                          {opt.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Aniversariante */}
              {type === 'Aniversário' && (
                <div ref={personBirthDropdownRef} className="p-3 bg-pink-50/80 rounded-2xl border border-pink-200 space-y-1.5 animate-in fade-in shrink-0">
                  <label className="text-xs font-black uppercase tracking-wider text-pink-900 block flex items-center gap-1.5">
                    <Gift className="w-4 h-4 text-pink-600" />
                    Vincular Servidor Municipal Aniversariante
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={personSearch}
                      onChange={e => {
                        setPersonSearch(e.target.value);
                        setShowPersonDropdown(true);
                      }}
                      onFocus={() => setShowPersonDropdown(true)}
                      placeholder="Pesquise o nome do servidor municipal..."
                      className="w-full px-3.5 py-2 pl-9 rounded-xl border border-pink-200 bg-white text-slate-800 font-bold text-xs sm:text-sm outline-none focus:border-pink-500 shadow-2xs"
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-pink-400" />

                    <AnimatePresence>
                      {showPersonDropdown && (
                        <motion.div
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 5 }}
                          className="absolute z-[3100] top-full left-0 right-0 mt-1 bg-white rounded-2xl shadow-xl border border-pink-100 max-h-48 overflow-y-auto custom-scrollbar p-1"
                        >
                          {persons.filter(p => p.name.toLowerCase().includes(personSearch.toLowerCase())).map(p => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                setProfessionalId(p.id);
                                setPersonSearch('');
                                setShowPersonDropdown(false);
                                if (!title) setTitle(`Aniversário: ${p.name}`);
                                if (p.birth_date) {
                                  const birth = new Date(p.birth_date);
                                  const currentYear = new Date(startDate || selectedDate).getFullYear();
                                  const calculatedDate = `${currentYear}-${String(birth.getUTCMonth() + 1).padStart(2, '0')}-${String(birth.getUTCDate()).padStart(2, '0')}`;
                                  setStartDate(calculatedDate);
                                  setEndDate(calculatedDate);
                                }
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-pink-50 rounded-lg text-xs font-bold text-slate-700 flex items-center justify-between cursor-pointer"
                            >
                              <span>{p.name}</span>
                              {p.birth_date && (
                                <span className="text-[10px] text-pink-600 font-mono font-bold bg-pink-100 px-2 py-0.5 rounded">
                                  {new Date(p.birth_date).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                </span>
                              )}
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              )}

            </div>

            {/* Rodapé da Aba 1 */}
            <div className="pt-2 border-t border-slate-100 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => navigateToStep('setor')}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-2xl transition-all flex items-center gap-2 shadow-sm cursor-pointer"
              >
                <span>Avançar para Setor & Servidores</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

          </motion.div>
        )}

        {/* ============================================================= */}
        {/* ABA 2: SETOR MUNICIPAL OFICIAL & SERVIDORES ENVOLVIDOS (MODAL) */}
        {/* ============================================================= */}
        {currentStep === 'setor' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-4 sm:p-5 lg:p-6 border border-slate-200 shadow-sm flex-1 flex flex-col justify-between overflow-hidden gap-3"
          >
            {/* Header da Aba */}
            <div className="border-b border-slate-100 pb-2 shrink-0 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight">
                  Setor Municipal Oficial & Servidores Vinculados
                </h2>
                <p className="text-[11px] text-slate-500 font-medium">
                  Selecione os Setores Oficiais de /Admin/Entidades e vincule as pessoas e servidores envolvidos no evento.
                </p>
              </div>
            </div>

            {/* Conteúdo Central em 2 Seções Dinâmicas e Modernas */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3.5 overflow-hidden">
              
              {/* CARD 1: SETORES MUNICIPAIS OFICIAIS */}
              <div className="bg-slate-50/80 rounded-2xl p-3.5 border border-slate-200/90 flex flex-col justify-between overflow-hidden shadow-2xs">
                
                {/* Header do Card */}
                <div className="flex items-center justify-between gap-2 border-b border-slate-200/60 pb-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                      <Building2 className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-slate-900 uppercase">Setores Oficiais</h3>
                      <p className="text-[10px] text-slate-500 font-medium">
                        {selectedSectorIds.length > 0 ? `${selectedSectorIds.length} setor(es) selecionado(s)` : 'Nenhum setor selecionado'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSectorSearchInModal('');
                      setShowSectorModal(true);
                    }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-[11px] font-black transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer shrink-0"
                  >
                    <span>+ Selecionar Setores</span>
                  </button>
                </div>

                {/* Lista / Grid de Setores Selecionados */}
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 my-2 space-y-1.5 min-h-[110px]">
                  {selectedSectorIds.length === 0 ? (
                    <div
                      onClick={() => {
                        setSectorSearchInModal('');
                        setShowSectorModal(true);
                      }}
                      className="h-full flex flex-col items-center justify-center text-center p-4 border-2 border-dashed border-slate-200 hover:border-indigo-300 bg-white/70 hover:bg-indigo-50/30 rounded-xl transition-all cursor-pointer group"
                    >
                      <Building2 className="w-8 h-8 text-slate-300 group-hover:text-indigo-500 transition-colors mb-1" />
                      <p className="text-xs font-bold text-slate-700 group-hover:text-indigo-950">Nenhum setor selecionado</p>
                      <p className="text-[10px] text-slate-400">Clique para abrir o modal e selecionar os setores municipais</p>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedSectorNames.map(name => {
                        const sec = sectorsList.find(s => s.name === name);
                        const countInSector = persons.filter(p => p.sectorId === sec?.id).length;
                        return (
                          <div
                            key={name}
                            className="inline-flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-white border border-indigo-200 text-slate-800 text-xs font-bold shadow-2xs group hover:border-indigo-300 transition-all"
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0"></span>
                              <span className="truncate max-w-[200px] text-slate-900 font-extrabold">{name}</span>
                              {countInSector > 0 && (
                                <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-100/60 font-bold">
                                  {countInSector} serv.
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (sec) {
                                  setSelectedSectorIds(prev => prev.filter(id => id !== sec.id));
                                }
                              }}
                              className="text-slate-400 hover:text-rose-600 cursor-pointer ml-1 transition-colors"
                              title="Remover setor"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Rodapé do Card */}
                {selectedSectorIds.length > 0 && (
                  <div className="pt-1.5 border-t border-slate-200/60 flex items-center justify-between shrink-0 text-[10px]">
                    <span className="text-slate-500 font-medium">Permite selecionar múltiplos setores simultaneamente</span>
                    <button
                      type="button"
                      onClick={() => setSelectedSectorIds([])}
                      className="text-rose-500 hover:text-rose-700 font-bold cursor-pointer transition-colors"
                    >
                      Limpar todos
                    </button>
                  </div>
                )}

              </div>

              {/* CARD 2: PESSOAS / SERVIDORES ENVOLVIDOS */}
              <div className="bg-slate-50/80 rounded-2xl p-3.5 border border-slate-200/90 flex flex-col justify-between overflow-hidden shadow-2xs">
                
                {/* Header do Card */}
                <div className="flex items-center justify-between gap-2 border-b border-slate-200/60 pb-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                      <Users className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h3 className="text-xs font-black text-slate-900 uppercase">Servidores Envolvidos</h3>
                      <p className="text-[10px] text-slate-500 font-medium">
                        {selectedPersonIds.length > 0 ? `${selectedPersonIds.length} servidor(es) vinculado(s)` : 'Nenhum servidor selecionado'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setPersonSearchInModal('');
                      setPersonSectorFilterInModal(selectedSectorIds.length > 0 ? selectedSectorIds[0] : 'todos');
                      setShowPersonsModal(true);
                    }}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white rounded-xl text-[11px] font-black transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer shrink-0"
                  >
                    <span>+ Selecionar Servidores</span>
                  </button>
                </div>

                {/* Lista de Servidores Selecionados */}
                <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 my-2 space-y-1.5 min-h-[110px]">
                  {selectedPersonIds.length === 0 ? (
                    <div
                      onClick={() => {
                        setPersonSearchInModal('');
                        setPersonSectorFilterInModal(selectedSectorIds.length > 0 ? selectedSectorIds[0] : 'todos');
                        setShowPersonsModal(true);
                      }}
                      className="h-full flex flex-col items-center justify-center text-center p-4 border-2 border-dashed border-slate-200 hover:border-indigo-300 bg-white/70 hover:bg-indigo-50/30 rounded-xl transition-all cursor-pointer group"
                    >
                      <Users className="w-8 h-8 text-slate-300 group-hover:text-indigo-500 transition-colors mb-1" />
                      <p className="text-xs font-bold text-slate-700 group-hover:text-indigo-950">Nenhum servidor vinculado</p>
                      <p className="text-[10px] text-slate-400">Clique para abrir o modal e escolher servidores por setor ou cargo</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {selectedPersonIds.map(id => {
                        const p = persons.find(x => x.id === id);
                        if (!p) return null;
                        const jobName = jobsList.find(j => j.id === p.jobId)?.name || p.role;
                        const secName = sectorsList.find(s => s.id === p.sectorId)?.name;

                        return (
                          <div
                            key={id}
                            className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white border border-slate-200 shadow-2xs group hover:border-indigo-300 transition-all"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-indigo-500 to-sky-500 text-white font-black text-[10px] flex items-center justify-center shrink-0 shadow-2xs">
                                {p.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-900 truncate leading-tight">{p.name}</p>
                                <div className="flex items-center gap-1 text-[9px] text-slate-500 truncate">
                                  {jobName && <span className="text-indigo-700 font-bold truncate">{jobName}</span>}
                                  {secName && <span>• {secName}</span>}
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setSelectedPersonIds(prev => prev.filter(x => x !== id))}
                              className="text-slate-400 hover:text-rose-600 cursor-pointer shrink-0 transition-colors p-1"
                              title="Remover servidor"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Rodapé do Card */}
                {selectedPersonIds.length > 0 && (
                  <div className="pt-1.5 border-t border-slate-200/60 flex items-center justify-between shrink-0 text-[10px]">
                    <span className="text-slate-500 font-medium">Vinculados automaticamente na pauta do evento</span>
                    <button
                      type="button"
                      onClick={() => setSelectedPersonIds([])}
                      className="text-rose-500 hover:text-rose-700 font-bold cursor-pointer transition-colors"
                    >
                      Limpar todos
                    </button>
                  </div>
                )}

              </div>

            </div>

            {/* Rodapé da Aba 2 */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => navigateToStep('identificacao')}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-2xl transition-all cursor-pointer"
              >
                Voltar
              </button>

              <button
                type="button"
                onClick={() => navigateToStep('programacao')}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-2xl transition-all flex items-center gap-2 shadow-sm cursor-pointer"
              >
                <span>Avançar para Programação</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

          </motion.div>
        )}

        {/* ============================================================= */}
        {/* ABA 3: PROGRAMAÇÃO, DATAS & HORÁRIOS */}
        {/* ============================================================= */}
        {currentStep === 'programacao' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-4 sm:p-5 lg:p-6 border border-slate-200 shadow-sm flex-1 flex flex-col justify-between overflow-hidden gap-3"
          >
            <div className="border-b border-slate-100 pb-2 shrink-0">
              <h2 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight">
                Programação, Datas & Horários
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Defina os prazos, datas de início e término e configure a modalidade de horário.
              </p>
            </div>

            <div className="flex-1 flex flex-col justify-around gap-2.5 overflow-hidden">
              
              {/* Toggles Rápidos */}
              <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-2.5 rounded-2xl border border-slate-200/80 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsAllDay(!isAllDay)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                    isAllDay
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Evento de Dia Inteiro</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const next = !isIndefinite;
                    setIsIndefinite(next);
                    if (next) setEndDate(startDate);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                    isIndefinite
                      ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200'
                  }`}
                >
                  <span>Sem Data de Término Definida</span>
                  <span className="font-mono font-black text-xs">∞</span>
                </button>
              </div>

              {/* Cards de Datas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                
                {/* Data Início */}
                <div ref={startDatePickerRef} className="space-y-1 bg-slate-50/70 p-3 rounded-2xl border border-slate-200 relative">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                    Data de Início <span className="text-rose-500">*</span>
                  </span>
                  
                  <button
                    type="button"
                    onClick={() => {
                      setShowStartDatePicker(!showStartDatePicker);
                      setShowEndDatePicker(false);
                    }}
                    className="w-full bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between text-left font-black text-xs sm:text-sm text-slate-900 shadow-2xs cursor-pointer group"
                  >
                    <span>
                      {startDate ? startDate.split('-').reverse().join('/') : 'Selecionar data'}
                    </span>
                    <CalendarDays className={`w-4 h-4 transition-colors ${showStartDatePicker ? 'text-indigo-600' : 'text-slate-400 group-hover:text-indigo-500'}`} />
                  </button>

                  <AnimatePresence>
                    {showStartDatePicker && (
                      <DatePickerModal
                        title="Selecionar Data de Início"
                        selectedDate={startDate}
                        onSelectDate={(newDate) => {
                          setStartDate(newDate);
                          if (isIndefinite || !endDate || endDate < newDate) setEndDate(newDate);
                        }}
                        onClose={() => setShowStartDatePicker(false)}
                      />
                    )}
                  </AnimatePresence>
                </div>

                {/* Data Término */}
                <div ref={endDatePickerRef} className="space-y-1 bg-slate-50/70 p-3 rounded-2xl border border-slate-200 relative">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                    Data de Término
                  </span>
                  
                  {isIndefinite ? (
                    <div className="bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between text-indigo-700">
                      <span className="text-xs sm:text-sm font-black">Tempo Indeterminado</span>
                      <span className="text-[10px] font-mono font-black bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded">∞</span>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setShowEndDatePicker(true);
                          setShowStartDatePicker(false);
                        }}
                        className="w-full bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between text-left font-black text-xs sm:text-sm text-slate-900 shadow-2xs cursor-pointer group"
                      >
                        <span>
                          {endDate ? endDate.split('-').reverse().join('/') : 'Selecionar data'}
                        </span>
                        <CalendarDays className={`w-4 h-4 transition-colors ${showEndDatePicker ? 'text-indigo-600' : 'text-slate-400 group-hover:text-indigo-500'}`} />
                      </button>

                      <AnimatePresence>
                        {showEndDatePicker && (
                          <DatePickerModal
                            title="Selecionar Data de Término"
                            selectedDate={endDate || startDate}
                            minDate={startDate}
                            onSelectDate={(newDate) => setEndDate(newDate)}
                            onClose={() => setShowEndDatePicker(false)}
                          />
                        )}
                      </AnimatePresence>
                    </>
                  )}
                </div>

              </div>

              {/* Horários */}
              <AnimatePresence>
                {!isAllDay && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-indigo-50/80 rounded-2xl border border-indigo-100 overflow-hidden shrink-0"
                  >
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-indigo-950 block">Horário de Início</label>
                      <input
                        type="time"
                        required={!isAllDay}
                        value={startTime}
                        onChange={e => setStartTime(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl border border-indigo-200 bg-white font-bold text-xs text-slate-800 outline-none shadow-2xs"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-indigo-950 block">Horário de Término</label>
                      <input
                        type="time"
                        required={!isAllDay}
                        value={endTime}
                        onChange={e => setEndTime(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-xl border border-indigo-200 bg-white font-bold text-xs text-slate-800 outline-none shadow-2xs"
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Recorrência Anual */}
              {(type !== 'Aniversário' && type !== 'Feriado Municipal') ? (
                <div
                  onClick={() => setIsRecurring(!isRecurring)}
                  className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer select-none shrink-0 ${
                    isRecurring
                      ? 'bg-indigo-50/90 border-indigo-300 text-indigo-900 shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Repeat className={`w-4 h-4 ${isRecurring ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <div>
                      <p className="text-xs font-bold">Repetir Anualmente</p>
                      <p className="text-[10px] text-slate-500 font-medium">Repete automaticamente todos os anos nesta mesma data.</p>
                    </div>
                  </div>

                  <div className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors ${
                    isRecurring ? 'bg-indigo-600' : 'bg-slate-300'
                  }`}>
                    <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      isRecurring ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </div>
                </div>
              ) : (
                <div className="p-2.5 bg-rose-50/80 rounded-2xl border border-rose-100 flex items-center justify-between text-rose-800 shrink-0">
                  <div className="flex items-center gap-2">
                    <Repeat className="w-4 h-4 text-rose-500 shrink-0" />
                    <div>
                      <p className="text-xs font-bold">Recorrência Anual Automática</p>
                      <p className="text-[10px] text-rose-600 font-medium">Ativa por padrão para este tipo de registro.</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-black uppercase bg-rose-100 px-2 py-0.5 rounded-lg">Ativo</span>
                </div>
              )}

            </div>

            {/* Rodapé da Aba 3 */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => navigateToStep('setor')}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Voltar
              </button>

              <button
                type="button"
                onClick={() => navigateToStep('jornal')}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <span>Avançar para Pauta & Jornal</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

          </motion.div>
        )}

        {/* ============================================================= */}
        {/* ABA 3: PAUTA, IMAGEM & JORNAL (IA) */}
        {/* ============================================================= */}
        {currentStep === 'jornal' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl p-4 sm:p-5 lg:p-6 border border-slate-200 shadow-sm flex-1 flex flex-col justify-between overflow-hidden gap-3"
          >
            <div className="border-b border-slate-100 pb-2 shrink-0">
              <h2 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight">
                Pauta & Publicação no Jornal Oficial com IA
              </h2>
              <p className="text-[11px] text-slate-500 font-medium">
                Adicione a pauta do evento, envie a foto oficial e gere a matéria automatizada via Inteligência Artificial.
              </p>
            </div>

            <div className="flex-1 flex flex-col justify-between gap-2.5 overflow-hidden">
              
              {/* Switch de Ativação do Jornal */}
              <div className={`p-3 rounded-2xl border transition-all shrink-0 ${
                publishToNews
                  ? 'bg-gradient-to-br from-indigo-50 via-sky-50 to-indigo-50 border-indigo-400 shadow-2xs ring-1 ring-indigo-500/20'
                  : 'bg-slate-50 border-slate-200'
              }`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      publishToNews ? 'bg-indigo-600 text-white shadow-xs' : 'bg-slate-200 text-slate-600'
                    }`}>
                      <Newspaper className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs sm:text-sm font-black text-slate-900">
                          Publicar na Gazeta Municipal (Jornal Oficial)
                        </span>
                        <span className="px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800 text-[9px] font-black uppercase flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5 text-indigo-600" /> IA
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 font-medium">
                        Redige automaticamente uma matéria jornalística oficial de alto impacto.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setPublishToNews(!publishToNews)}
                    className={`px-3.5 py-1.5 rounded-xl font-black text-[11px] transition-all flex items-center gap-2 cursor-pointer shadow-2xs active:scale-95 shrink-0 ${
                      publishToNews
                        ? 'bg-gradient-to-r from-indigo-600 to-sky-600 text-white shadow-indigo-500/30'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300'
                    }`}
                  >
                    <div className={`w-7 h-4 rounded-full p-0.5 transition-colors flex items-center ${
                      publishToNews ? 'bg-white/30 justify-end' : 'bg-slate-300 justify-start'
                    }`}>
                      <div className="w-3 h-3 rounded-full bg-white shadow-xs" />
                    </div>
                    <span className="uppercase text-[10px]">
                      {publishToNews ? 'Publicação Ativa' : 'Ativar Publicação'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Upload e Pauta lado a lado em telas médias/grandes */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 flex-1 overflow-hidden">
                
                {/* Upload de Foto */}
                <div className="md:col-span-4 flex flex-col justify-between space-y-1">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageFileChange}
                    accept="image/*"
                    className="hidden"
                  />

                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center justify-between">
                    <span>Foto Oficial {publishToNews && <strong className="text-rose-500">*</strong>}</span>
                    {imageUrl && (
                      <button
                        type="button"
                        onClick={() => setImageUrl('')}
                        className="text-[10px] text-rose-500 hover:text-rose-700 font-bold cursor-pointer"
                      >
                        Remover
                      </button>
                    )}
                  </label>

                  {imageUrl ? (
                    <div className="flex-1 p-2.5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center gap-2 text-center">
                      <div className="w-full h-24 rounded-xl overflow-hidden border border-slate-300 bg-slate-900/10">
                        <img src={imageUrl} alt="Foto anexada" className="w-full h-full object-cover" />
                      </div>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-[10px] font-bold shadow-2xs cursor-pointer"
                      >
                        Trocar Imagem
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className={`flex-1 p-4 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all ${
                        publishToNews
                          ? 'border-indigo-400 bg-indigo-50/50 hover:bg-indigo-50'
                          : 'border-slate-300 bg-slate-50 hover:bg-white'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-xl bg-white text-indigo-600 shadow-2xs flex items-center justify-center">
                        <Camera className="w-4 h-4" />
                      </div>
                      <p className="text-[11px] font-black text-slate-800 text-center">Clique para enviar a foto</p>
                      <p className="text-[9px] text-slate-400 text-center">PNG, JPG ou WebP</p>
                    </div>
                  )}
                </div>

                {/* Pauta & Descrição */}
                <div className="md:col-span-8 flex flex-col space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 block">
                    Pauta & Descrição do Evento (Diretrizes para a IA)
                  </label>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Descreva detalhes, autoridades presentes ou objetivos para a matéria institucional..."
                    className="w-full flex-1 p-3 rounded-2xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800 font-medium placeholder:text-slate-400 outline-none resize-none text-xs shadow-inner min-h-[90px]"
                  />
                </div>

              </div>

              {/* Botão de Geração com IA */}
              {publishToNews && (
                <div className="p-2.5 bg-gradient-to-r from-indigo-50 to-sky-50 rounded-2xl border border-indigo-200 flex items-center justify-between gap-2 shrink-0">
                  <p className="text-[11px] text-indigo-900 font-bold truncate">
                    {aiPreview ? '✨ Matéria gerada com sucesso pela IA!' : 'Gere uma prévia da matéria formatada.'}
                  </p>

                  <button
                    type="button"
                    onClick={handleGeneratePreviewAI}
                    disabled={isGeneratingAI}
                    className="px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    {isGeneratingAI ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                    <span>{aiPreview ? 'Revisar Matéria' : 'Gerar com IA'}</span>
                  </button>
                </div>
              )}

            </div>

            {/* Rodapé da Aba 4 (Final da Esteira) */}
            <div className="pt-2 border-t border-slate-100 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => navigateToStep('programacao')}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer"
              >
                Voltar
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={loading}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black rounded-xl transition-all flex items-center gap-2 shadow-md shadow-emerald-600/30 cursor-pointer active:scale-95 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>{eventToEdit ? 'Concluir & Salvar Alterações' : 'Concluir & Salvar Registro'}</span>
              </button>
            </div>

          </motion.div>
        )}

      </div>

      {/* Modal de Prévia de Matéria com IA */}
      <AnimatePresence>
        {showAiPreviewModal && aiPreview && (
          <div className="fixed inset-0 z-[3600] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in font-sans">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-5 space-y-3 shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" />
                  <h3 className="text-sm sm:text-base font-black text-slate-900">Prévia da Matéria Jornalística</h3>
                </div>
                <button onClick={() => setShowAiPreviewModal(false)} className="text-slate-400 hover:text-slate-600 font-black cursor-pointer">✕</button>
              </div>

              <div className="space-y-2.5 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400">Título / Manchete</span>
                  <p className="text-xs sm:text-sm font-black text-slate-900">{aiPreview.manchete}</p>
                </div>

                {aiPreview.subtitulo && (
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-400">Subtítulo / Lead</span>
                    <p className="text-xs font-medium text-slate-700 italic">"{aiPreview.subtitulo}"</p>
                  </div>
                )}

                <div>
                  <span className="text-[10px] font-black uppercase text-slate-400">Corpo da Matéria</span>
                  <div className="text-xs text-slate-800 whitespace-pre-line leading-relaxed font-serif pt-1">
                    {aiPreview.corpo}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowAiPreviewModal(false)}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors"
                >
                  Confirmar & Fechar Prévia
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE SELEÇÃO DE SETORES MUNICIPAIS OFICIAIS */}
      <AnimatePresence>
        {showSectorModal && (
          <div className="fixed inset-0 z-[3500] flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-md animate-fade-in font-sans">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className="bg-white rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[85vh] overflow-hidden"
            >
              {/* Header do Modal */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 tracking-tight">Selecionar Setores Oficiais</h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Escolha um ou múltiplos setores cadastrados em /Admin/Entidades
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowSectorModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center font-black cursor-pointer transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Barra de Pesquisa e Ações Rápidas */}
              <div className="py-3 shrink-0 space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    autoFocus
                    value={sectorSearchInModal}
                    onChange={e => setSectorSearchInModal(e.target.value)}
                    placeholder="Pesquise por nome do setor municipal ou secretaria..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-inner"
                  />
                </div>

                <div className="flex items-center justify-between text-xs px-1">
                  <span className="text-[11px] text-indigo-950 font-bold">
                    {selectedSectorIds.length} setor(es) selecionado(s) de {sectorsList.length}
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedSectorIds(sectorsList.map(s => s.id))}
                      className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                    >
                      Selecionar Todos
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={() => setSelectedSectorIds([])}
                      className="text-[11px] font-bold text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      Desmarcar Todos
                    </button>
                  </div>
                </div>
              </div>

              {/* Grade de Setores */}
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 space-y-1.5 min-h-[220px]">
                {sectorsList
                  .filter(s => s.name.toLowerCase().includes(sectorSearchInModal.toLowerCase()))
                  .map(sec => {
                    const isSelected = selectedSectorIds.includes(sec.id);
                    const serverCount = persons.filter(p => p.sectorId === sec.id).length;

                    return (
                      <div
                        key={sec.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedSectorIds(prev => prev.filter(id => id !== sec.id));
                          } else {
                            setSelectedSectorIds(prev => [...prev, sec.id]);
                          }
                        }}
                        className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer select-none ${
                          isSelected
                            ? 'bg-indigo-50/90 border-indigo-400 shadow-2xs'
                            : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-colors shrink-0 ${
                            isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'
                          }`}>
                            {isSelected && <CheckSquare className="w-3.5 h-3.5" />}
                          </div>

                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">{sec.name}</p>
                            <p className="text-[10px] text-slate-400">Entidade Oficial Cadastrada</p>
                          </div>
                        </div>

                        {serverCount > 0 && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-lg bg-indigo-100/80 text-indigo-800 font-bold shrink-0">
                            {serverCount} servidores
                          </span>
                        )}
                      </div>
                    );
                  })}
              </div>

              {/* Rodapé do Modal */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
                <span className="text-[11px] text-slate-400 font-medium">Os servidores desses setores serão filtrados na próxima etapa</span>
                <button
                  type="button"
                  onClick={() => setShowSectorModal(false)}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black cursor-pointer transition-colors shadow-sm"
                >
                  Concluir Seleção ({selectedSectorIds.length})
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE SELEÇÃO DE PESSOAS / SERVIDORES ENVOLVIDOS */}
      <AnimatePresence>
        {showPersonsModal && (
          <div className="fixed inset-0 z-[3500] flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-md animate-fade-in font-sans">
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              className="bg-white rounded-3xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 flex flex-col max-h-[85vh] overflow-hidden"
            >
              {/* Header do Modal */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-black text-slate-900 tracking-tight">Selecionar Servidores & Pessoas</h3>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Vincule os servidores públicos que participarão ou estarão presentes
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowPersonsModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center font-black cursor-pointer transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Barra de Pesquisa e Filtros Rápidos */}
              <div className="py-3 shrink-0 space-y-2.5">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    autoFocus
                    value={personSearchInModal}
                    onChange={e => setPersonSearchInModal(e.target.value)}
                    placeholder="Pesquise por nome do servidor ou cargo oficial..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs sm:text-sm font-bold text-slate-800 outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 transition-all shadow-inner"
                  />
                </div>

                {/* Filtro em pílulas por Setores */}
                {selectedSectorIds.length > 0 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-0.5">
                    <span className="text-[10px] font-black uppercase text-slate-400 shrink-0 mr-1">Filtrar por:</span>
                    <button
                      type="button"
                      onClick={() => setPersonSectorFilterInModal('todos')}
                      className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
                        personSectorFilterInModal === 'todos'
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      Todos os Selecionados
                    </button>

                    {selectedSectorIds.map(secId => {
                      const sec = sectorsList.find(s => s.id === secId);
                      if (!sec) return null;
                      const isActive = personSectorFilterInModal === sec.id;
                      return (
                        <button
                          key={sec.id}
                          type="button"
                          onClick={() => setPersonSectorFilterInModal(sec.id)}
                          className={`px-2.5 py-1 rounded-xl text-[10px] font-black tracking-wider transition-all cursor-pointer shrink-0 truncate max-w-[180px] ${
                            isActive
                              ? 'bg-indigo-600 text-white shadow-2xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                          }`}
                        >
                          {sec.name}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="flex items-center justify-between text-xs px-1">
                  <span className="text-[11px] text-indigo-950 font-bold">
                    {selectedPersonIds.length} servidor(es) selecionado(s)
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedPersonIds([])}
                      className="text-[11px] font-bold text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      Limpar Seleção
                    </button>
                  </div>
                </div>
              </div>

              {/* Grade de Servidores */}
              <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 grid grid-cols-1 sm:grid-cols-2 gap-2 min-h-[220px]">
                {persons
                  .filter(p => {
                    const matchesSectorFilter =
                      personSectorFilterInModal === 'todos'
                        ? (selectedSectorIds.length === 0 || selectedSectorIds.includes(p.sectorId || ''))
                        : p.sectorId === personSectorFilterInModal;

                    const jobName = jobsList.find(j => j.id === p.jobId)?.name || p.role || '';
                    const matchesSearch =
                      p.name.toLowerCase().includes(personSearchInModal.toLowerCase()) ||
                      jobName.toLowerCase().includes(personSearchInModal.toLowerCase());

                    return matchesSectorFilter && matchesSearch;
                  })
                  .map(p => {
                    const isSelected = selectedPersonIds.includes(p.id);
                    const jobName = jobsList.find(j => j.id === p.jobId)?.name || p.role || 'Servidor';
                    const secName = sectorsList.find(s => s.id === p.sectorId)?.name;

                    return (
                      <div
                        key={p.id}
                        onClick={() => {
                          if (isSelected) {
                            setSelectedPersonIds(prev => prev.filter(id => id !== p.id));
                          } else {
                            setSelectedPersonIds(prev => [...prev, p.id]);
                          }
                        }}
                        className={`flex items-center justify-between gap-2.5 p-3 rounded-2xl border transition-all cursor-pointer select-none ${
                          isSelected
                            ? 'bg-indigo-50/90 border-indigo-400 shadow-2xs'
                            : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-colors shrink-0 ${
                            isSelected ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'
                          }`}>
                            {isSelected && <CheckSquare className="w-3.5 h-3.5" />}
                          </div>

                          <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-indigo-500 to-sky-500 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                            {p.name.charAt(0).toUpperCase()}
                          </div>

                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-bold text-slate-900 truncate leading-tight">{p.name}</p>
                            <div className="flex items-center gap-1 text-[10px] text-slate-500 truncate">
                              <span className="text-indigo-700 font-bold truncate">{jobName}</span>
                              {secName && <span className="truncate">• {secName}</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Rodapé do Modal */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between shrink-0">
                <span className="text-[11px] text-slate-400 font-medium">As pessoas selecionadas serão associadas à pauta do evento</span>
                <button
                  type="button"
                  onClick={() => setShowPersonsModal(false)}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black cursor-pointer transition-colors shadow-sm"
                >
                  Concluir Seleção ({selectedPersonIds.length})
                </button>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
