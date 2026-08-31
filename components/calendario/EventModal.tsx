import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Calendar as CalendarIcon,
  Save,
  Trash2,
  Loader2,
  Users,
  CheckSquare,
  Square,
  Lock,
  Flag,
  Gift,
  Search,
  Repeat,
  Clock,
  Sparkles,
  FileText,
  AlertCircle,
  Newspaper,
  Image as ImageIcon,
  Upload,
  CheckCircle2,
  Wand2,
  Camera,
  Layers,
  ArrowRight,
  Building2,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../services/supabaseClient';
import { calendarService, CalendarEventInvite, CalendarEvent } from '../../services/calendarService';
import { getPersons, getSectors } from '../../services/entityService';
import { getLocalISOData } from '../../utils/dateUtils';
import { Person, JornalMateria, Sector } from '../../types';
import { generateMateriaJornalWithAI, GeneratedMateriaJornal } from '../../services/geminiService';
import { noticiasService } from '../../services/noticiasService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  eventToEdit: CalendarEvent | null;
  selectedDate: string; // YYYY-MM-DD
  currentUserId: string;
}

interface UserProfile {
  id: string;
  name: string;
}

export const EventModal: React.FC<Props> = ({
  isOpen,
  onClose,
  onSaved,
  eventToEdit,
  selectedDate,
  currentUserId
}) => {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('Pessoal');
  const [sector, setSector] = useState('');
  const [sectorsList, setSectorsList] = useState<Sector[]>([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isAllDay, setIsAllDay] = useState(true);
  const [isIndefinite, setIsIndefinite] = useState(false);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('17:00');
  const [description, setDescription] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);

  // 📰 Imagem e Publicação no Jornal
  const [imageUrl, setImageUrl] = useState<string>('');
  const [publishToNews, setPublishToNews] = useState(false);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiPreview, setAiPreview] = useState<GeneratedMateriaJornal | null>(null);
  const [showAiPreviewModal, setShowAiPreviewModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Invites State
  const [activeTab, setActiveTab] = useState<'details' | 'invites'>('details');
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [persons, setPersons] = useState<Person[]>([]);
  const [professionalId, setProfessionalId] = useState('');
  const [personSearch, setPersonSearch] = useState('');
  const [showPersonDropdown, setShowPersonDropdown] = useState(false);
  const [selectedInvites, setSelectedInvites] = useState<{ user_id: string; role: 'Colaborador' | 'Participante' }[]>([]);

  const DEFAULT_SECTORES = [
    'Gabinete do Prefeito',
    'Secretaria de Saúde',
    'Secretaria de Educação',
    'Secretaria de Obras & Infraestrutura',
    'Secretaria de Administração & Fazenda',
    'Secretaria de Assistência Social',
    'Departamento de Transporte & Frotas',
    'Departamento de Meio Ambiente',
    'Departamento de Agricultura & Pecuária',
    'Departamento de Cultura & Turismo',
    'Departamento de Esporte & Lazer',
    'Departamento de Compras & Licitação',
    'Departamento de Recursos Humanos',
    'Assessoria de Comunicação & Imprensa',
    'Controladoria Geral do Município'
  ];

  const allSectorOptions = Array.from(new Set([
    ...sectorsList.map(s => s.name),
    ...DEFAULT_SECTORES
  ])).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      fetchSectors();
      if (eventToEdit) {
        setTitle(eventToEdit.title);
        setType(eventToEdit.type);
        setSector((eventToEdit as any).sector || '');
        setStartDate(eventToEdit.start_date);
        setEndDate(eventToEdit.end_date || eventToEdit.start_date);
        setIsAllDay(eventToEdit.is_all_day);
        setIsIndefinite((eventToEdit as any).is_indefinite || false);
        setStartTime(eventToEdit.start_time || '08:00');
        setEndTime(eventToEdit.end_time || '17:00');
        setDescription(eventToEdit.description || '');
        setIsRecurring(eventToEdit.is_recurring || false);
        setProfessionalId(eventToEdit.professional_id || '');
        setImageUrl((eventToEdit as any).image_url || '');

        // Manter o estado de publicação no jornal exatamente igual à criação
        const wasPublished = (eventToEdit as any).publish_to_news ?? (eventToEdit.type === 'Notícia');
        setPublishToNews(Boolean(wasPublished));
        setAiPreview(null);

        // Se houver matéria publicada vinculada a este evento, recuperar imagem e manter publicação ativa
        noticiasService.getMateriasPublicadas().then(materias => {
          const linked = materias.find(m => (eventToEdit.id && m.eventoId === eventToEdit.id) || m.titulo === eventToEdit.title);
          if (linked) {
            setPublishToNews(true);
            if (!(eventToEdit as any).image_url && linked.imagemUrl) {
              setImageUrl(linked.imagemUrl);
            }
          }
        }).catch(err => console.warn('Verificação de matéria vinculada:', err));

        if (eventToEdit.invites) {
          setSelectedInvites(
            eventToEdit.invites.map(inv => ({ user_id: inv.user_id, role: inv.role }))
          );
        } else {
          setSelectedInvites([]);
        }
        setActiveTab('details');
      } else {
        setTitle('');
        setType('Pessoal');
        setSector('');
        const defaultDate = getLocalISOData(new Date()).date;
        setStartDate(selectedDate || defaultDate);
        setEndDate(selectedDate || defaultDate);
        setIsAllDay(true);
        setIsIndefinite(false);
        setStartTime('08:00');
        setEndTime('17:00');
        setDescription('');
        setIsRecurring(false);
        setProfessionalId('');
        setImageUrl('');
        setPublishToNews(false);
        setAiPreview(null);
        setSelectedInvites([]);
        setActiveTab('details');
      }
      fetchPersons();
    }
  }, [isOpen, eventToEdit, selectedDate]);

  const fetchSectors = async () => {
    try {
      const data = await getSectors();
      if (data && data.length > 0) {
        setSectorsList(data);
      }
    } catch (e) {
      console.warn('Erro ao carregar setores:', e);
    }
  };

  const fetchUsers = async () => {
    const { data } = await supabase.from('profiles').select('id, name').order('name');
    if (data) {
      setAllUsers(data.filter(u => u.id !== currentUserId));
    }
  };

  const fetchPersons = async () => {
    const data = await getPersons();
    setPersons(data);
  };

  // Upload e Compressão Inteligente de Imagem
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      setErrorMessage('A imagem deve ter no máximo 15MB.');
      return;
    }

    try {
      // 1. Comprime a imagem no navegador para formato JPEG otimizado (max 1200px, 0.75 qualidade)
      const compressedDataUrl: string = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (readerEvent) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 1200;
            const MAX_HEIGHT = 1200;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_WIDTH) {
                height = Math.round((height * MAX_WIDTH) / width);
                width = MAX_WIDTH;
              }
            } else {
              if (height > MAX_HEIGHT) {
                width = Math.round((width * MAX_HEIGHT) / height);
                height = MAX_HEIGHT;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, width, height);
              resolve(canvas.toDataURL('image/jpeg', 0.75));
            } else {
              resolve(readerEvent.target?.result as string || '');
            }
          };
          img.onerror = () => resolve(readerEvent.target?.result as string || '');
          img.src = readerEvent.target?.result as string;
        };
        reader.readAsDataURL(file);
      });

      // 2. Tenta enviar para o Supabase Storage se o bucket estiver configurado
      try {
        const storagePath = `eventos/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('attachments')
          .upload(storagePath, file, { upsert: true });

        if (!uploadErr && uploadData) {
          const { data: publicUrlData } = supabase.storage.from('attachments').getPublicUrl(storagePath);
          if (publicUrlData?.publicUrl) {
            setImageUrl(publicUrlData.publicUrl);
            return;
          }
        }
      } catch (storageErr) {
        console.warn('Storage fallback to compressed data URL:', storageErr);
      }

      // Fallback: usa imagem comprimida (~50KB a 90KB)
      setImageUrl(compressedDataUrl);
    } catch (err: any) {
      console.error('Erro ao processar imagem:', err);
      setErrorMessage('Erro ao carregar a imagem.');
    }
  };

  // Gerar Prévia da Matéria com IA (considerando o Setor)
  const handleGeneratePreviewAI = async () => {
    if (!title.trim()) {
      setErrorMessage('Informe o título do registro para a IA gerar a matéria.');
      return;
    }

    setIsGeneratingAI(true);
    setErrorMessage(null);
    try {
      const generated = await generateMateriaJornalWithAI({
        titulo: title,
        tipoEvento: type,
        dataInicio: startDate,
        dataFim: endDate,
        horaInicio: isAllDay ? undefined : startTime,
        horaFim: isAllDay ? undefined : endTime,
        descricao: description,
        setor: sector
      });

      setAiPreview(generated);
      setShowAiPreviewModal(true);
    } catch (err: any) {
      setErrorMessage(err.message || 'Erro ao gerar matéria com IA.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    if (!title.trim() || !startDate) return;

    const finalEndDate = isIndefinite ? startDate : (endDate || startDate);

    if (!isIndefinite && startDate > finalEndDate) {
      setErrorMessage('A data de término não pode ser anterior à data de início.');
      return;
    }

    if (!isAllDay && !isIndefinite) {
      if (!startTime || !endTime) {
        setErrorMessage('Informe os horários de início e término.');
        return;
      }
      if (startDate === finalEndDate && startTime >= endTime) {
        setErrorMessage('O horário de término deve ser posterior ao horário de início.');
        return;
      }
    }

    // 📸 Validação Obrigatória: Foto para publicação no Jornal Oficial
    if (publishToNews && !imageUrl) {
      setErrorMessage('Para publicar a matéria no Jornal Oficial, o upload de uma foto oficial é obrigatório.');
      return;
    }

    setLoading(true);
    try {
      // 1. Se marcado para publicar no jornal, gerar ou usar prévia da IA
      let finalMateriaData = aiPreview;
      if (publishToNews && !finalMateriaData) {
        finalMateriaData = await generateMateriaJornalWithAI({
          titulo: title,
          tipoEvento: type,
          dataInicio: startDate,
          dataFim: endDate,
          horaInicio: isAllDay ? undefined : startTime,
          horaFim: isAllDay ? undefined : endTime,
          descricao: description,
          setor: sector
        });
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
        sector: sector || undefined,
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

      // Publicar no feed de notícias (aguardando aprovação editorial de administrador)
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
          setor: sector || undefined,
          oculta: false,
          aprovada: false, // Fica pendente de aprovação de administrador
          status: 'pendente',
          curtidas: 1
        };

        await noticiasService.salvarMateria(novaMateria);
      }

      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Error saving event:', err);
      setErrorMessage(err.message || 'Erro ao salvar registro no calendário.');
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!eventToEdit) return;
    setDeleting(true);
    setErrorMessage(null);
    try {
      await calendarService.deleteEvent(eventToEdit.id);
      onSaved();
      onClose();
    } catch (err: any) {
      console.error('Error deleting event:', err);
      setErrorMessage(err.message || 'Erro ao excluir o evento.');
    } finally {
      setDeleting(false);
      setIsConfirmDeleteOpen(false);
    }
  };

  const toggleInvite = (userId: string) => {
    setSelectedInvites(prev => {
      const exists = prev.find(i => i.user_id === userId);
      if (exists) {
        return prev.filter(i => i.user_id !== userId);
      } else {
        return [...prev, { user_id: userId, role: 'Participante' }];
      }
    });
  };

  const setRole = (userId: string, role: 'Colaborador' | 'Participante') => {
    setSelectedInvites(prev =>
      prev.map(i => i.user_id === userId ? { ...i, role } : i)
    );
  };

  const selectAll = () => {
    if (selectedInvites.length === allUsers.length) {
      setSelectedInvites([]);
    } else {
      setSelectedInvites(allUsers.map(u => ({ user_id: u.id, role: 'Participante' })));
    }
  };

  const EVENT_TYPES = [
    { value: 'Notícia', label: 'Notícia', icon: Newspaper, color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-200', active: 'bg-sky-600 text-white shadow-sky-600/25' },
    { value: 'Pessoal', label: 'Pessoal', icon: Lock, color: 'text-amber-500', bg: 'bg-amber-50', border: 'border-amber-200', active: 'bg-amber-500 text-white shadow-amber-500/25' },
    { value: 'Reunião', label: 'Reunião', icon: Users, color: 'text-indigo-500', bg: 'bg-indigo-50', border: 'border-indigo-200', active: 'bg-indigo-600 text-white shadow-indigo-600/25' },
    { value: 'Evento', label: 'Evento', icon: CalendarIcon, color: 'text-emerald-500', bg: 'bg-emerald-50', border: 'border-emerald-200', active: 'bg-emerald-600 text-white shadow-emerald-600/25' },
    { value: 'Aniversário', label: 'Aniversário', icon: Gift, color: 'text-pink-500', bg: 'bg-pink-50', border: 'border-pink-200', active: 'bg-pink-600 text-white shadow-pink-600/25' },
    { value: 'Feriado Municipal', label: 'Feriado Municipal', icon: Flag, color: 'text-rose-500', bg: 'bg-rose-50', border: 'border-rose-200', active: 'bg-rose-600 text-white shadow-rose-600/25' },
    { value: 'Feriado', label: 'Feriado Geral', icon: Flag, color: 'text-purple-500', bg: 'bg-purple-50', border: 'border-purple-200', active: 'bg-purple-600 text-white shadow-purple-600/25' }
  ];

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[2500] flex items-center justify-center p-3 sm:p-5 lg:p-6 overflow-hidden">
        
        {/* Backdrop com desfoque refinado */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-md transition-opacity"
          onClick={onClose}
        />

        {/* Modal Card Ultra-Moderno */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="w-[94vw] max-w-5xl h-[84vh] min-h-[580px] max-h-[820px] bg-white rounded-[2rem] shadow-2xl relative z-10 flex flex-col border border-slate-200/80 overflow-hidden font-sans my-auto"
        >
          
          {/* Header Elegante em Dark Indigo Gradient */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-6 py-4 flex items-center justify-between gap-4 shrink-0 border-b border-white/10 relative overflow-hidden">
            <div className="relative z-10 flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-lg shrink-0">
                <CalendarIcon className="w-5 h-5 text-indigo-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base sm:text-lg font-black tracking-tight text-white uppercase leading-tight">
                    {eventToEdit ? 'Editar Compromisso' : 'Novo Registro no Calendário'}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-[10px] font-black uppercase">
                    {type}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 font-medium">
                  Prefeitura Municipal • Gestão Integrada de Agenda & Publicação no Jornal
                </p>
              </div>
            </div>

            {/* Abas e Botão Fechar */}
            <div className="relative z-10 flex items-center gap-2.5">
              <div className="flex items-center gap-1 bg-white/10 backdrop-blur-md p-1 rounded-2xl border border-white/15">
                <button
                  type="button"
                  onClick={() => setActiveTab('details')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'details'
                      ? 'bg-white text-slate-950 shadow-md font-black'
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Dados do Evento</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('invites')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'invites'
                      ? 'bg-white text-slate-950 shadow-md font-black'
                      : 'text-white/80 hover:text-white'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Convidados</span>
                  {selectedInvites.length > 0 && (
                    <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-black">
                      {selectedInvites.length}
                    </span>
                  )}
                </button>
              </div>

              <button
                onClick={onClose}
                className="w-9 h-9 rounded-2xl bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/15 flex items-center justify-center text-slate-300 hover:text-white transition-all cursor-pointer shrink-0"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Banner de Erro */}
          {errorMessage && (
            <div className="mx-6 mt-2.5 p-2.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs font-bold flex items-center justify-between shrink-0 shadow-sm animate-in fade-in">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                <span>{errorMessage}</span>
              </div>
              <button onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-rose-700 font-black">✕</button>
            </div>
          )}

          {/* Form Body com 2 Colunas Equilibradas */}
          <div className="flex-1 px-6 py-4 overflow-hidden flex flex-col justify-between">
            {activeTab === 'details' ? (
              <form id="event-form" onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-full">
                
                {/* --------------------------------------------------------------- */}
                {/* COLUNA ESQUERDA (7 colunas): Título, Tipos, Imagem, Descrição */}
                {/* --------------------------------------------------------------- */}
                <div className="lg:col-span-7 flex flex-col justify-between space-y-3">
                  
                  {/* Linha 1: Título do Registro + Setor Responsável */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                    <div className="sm:col-span-7 space-y-1">
                      <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 block">
                        Título do Registro <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={title}
                        onChange={e => setTitle(e.target.value)}
                        placeholder="Ex: Inauguração da Nova Unidade de Saúde Central"
                        className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800 font-bold placeholder:text-slate-400 outline-none text-xs shadow-xs"
                      />
                    </div>

                    <div className="sm:col-span-5 space-y-1">
                      <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 block flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                        Setor Municipal
                      </label>
                      <div className="relative">
                        <select
                          value={sector}
                          onChange={e => setSector(e.target.value)}
                          className="w-full pl-3.5 pr-8 py-2.5 rounded-2xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-800 font-bold outline-none text-xs shadow-xs cursor-pointer appearance-none"
                        >
                          <option value="">Selecione o setor...</option>
                          {allSectorOptions.map((sec, idx) => (
                            <option key={idx} value={sec}>{sec}</option>
                          ))}
                        </select>
                        <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  {/* Seletor de Tipos em Grid Harmônico e Proporcional de 7 Itens */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 block">
                        Tipo de Evento
                      </label>
                      <span className="text-[10px] font-bold text-slate-400">
                        {EVENT_TYPES.find(t => t.value === type)?.label || type}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-1.5">
                      {EVENT_TYPES.map(opt => {
                        const Icon = opt.icon;
                        const isSelected = type === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => {
                              setType(opt.value);
                              if (opt.value === 'Notícia') {
                                setPublishToNews(true);
                              }
                            }}
                            className={`py-2 px-1.5 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1 cursor-pointer active:scale-95 select-none ${
                              isSelected
                                ? `${opt.active} border-transparent shadow-md font-black ring-2 ring-indigo-500/20`
                                : 'bg-slate-50/90 hover:bg-white text-slate-700 border-slate-200/90 hover:border-slate-300 shadow-2xs'
                            }`}
                          >
                            <div className={`w-6 h-6 rounded-xl flex items-center justify-center shrink-0 ${
                              isSelected ? 'bg-white/20 text-white' : `${opt.bg} ${opt.color}`
                            }`}>
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <span className="text-[10px] font-bold tracking-tight text-center leading-tight whitespace-nowrap">
                              {opt.label === 'Feriado Municipal' ? 'Feriado Mun.' : opt.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Aniversariante / Servidor se for Aniversário */}
                  {type === 'Aniversário' && (
                    <div className="p-2.5 bg-pink-50/80 rounded-2xl border border-pink-200 space-y-1 animate-in fade-in">
                      <label className="text-[10px] font-black uppercase tracking-wider text-pink-900 block flex items-center gap-1.5">
                        <Gift className="w-3 h-3 text-pink-600" />
                        Vincular Servidor Municipal
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
                          placeholder="Pesquise o nome do servidor..."
                          className="w-full px-3 py-1.5 pl-8 rounded-xl border border-pink-200 bg-white text-slate-800 font-bold text-xs outline-none focus:border-pink-500"
                        />
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-pink-400" />

                        {professionalId && !personSearch && (
                          <div className="absolute left-8 top-1/2 -translate-y-1/2 flex items-center gap-2">
                            <span className="text-xs font-black text-pink-700 bg-pink-100 px-2 py-0.5 rounded-lg">
                              {persons.find(p => p.id === professionalId)?.name}
                            </span>
                          </div>
                        )}

                        <AnimatePresence>
                          {showPersonDropdown && (
                            <motion.div
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 5 }}
                              className="absolute z-[3100] top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-pink-100 max-h-36 overflow-y-auto custom-scrollbar"
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
                                  className="w-full text-left px-3 py-1.5 hover:bg-pink-50 text-xs font-bold text-slate-700 border-b border-pink-50 last:border-0 flex items-center justify-between"
                                >
                                  <span>{p.name}</span>
                                  {p.birth_date && (
                                    <span className="text-[10px] text-pink-600 font-mono font-bold bg-pink-100 px-1.5 py-0.5 rounded">
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

                  {/* Descrição & Botão de Upload Integrado */}
                  <div className="space-y-1.5 flex-1 flex flex-col">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black uppercase tracking-wider text-slate-500 block">
                        Pauta & Descrição do Evento (Opcional)
                      </label>

                      {/* Botão de Upload / Preview da Imagem */}
                      <div className="flex items-center gap-2">
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleImageFileChange}
                          accept="image/*"
                          className="hidden"
                        />

                        {imageUrl ? (
                          <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-xl shadow-xs animate-in fade-in">
                            <div className="w-5 h-5 rounded-md overflow-hidden bg-slate-200 shrink-0 border border-emerald-300">
                              <img src={imageUrl} alt="Foto anexada" className="w-full h-full object-cover" />
                            </div>
                            <span className="text-[11px] font-bold text-emerald-800">Foto Anexada</span>
                            <button
                              type="button"
                              onClick={() => setImageUrl('')}
                              className="text-emerald-700 hover:text-rose-600 text-xs font-black ml-1 cursor-pointer transition-colors"
                              title="Remover Foto"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className={`px-3 py-1 border rounded-xl text-[11px] font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-95 ${
                              publishToNews
                                ? 'bg-rose-50 hover:bg-rose-100 border-rose-300 text-rose-700 ring-2 ring-rose-500/20 animate-pulse'
                                : 'bg-white hover:bg-indigo-50 border-slate-200 hover:border-indigo-200 text-slate-700 hover:text-indigo-600'
                            }`}
                          >
                            <Camera className={`w-3.5 h-3.5 ${publishToNews ? 'text-rose-600' : 'text-indigo-500'}`} />
                            <span>{publishToNews ? 'Adicionar Imagem * (Obrigatória)' : 'Adicionar Imagem'}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Descreva o que será abordado, detalhes do evento ou objetivos para a matéria institucional..."
                      className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-700 font-medium placeholder:text-slate-400 outline-none resize-none flex-1 min-h-[90px] text-xs shadow-inner"
                    />
                  </div>

                </div>

                {/* --------------------------------------------------------------- */}
                {/* COLUNA DIREITA (5 colunas): Datas, Publicar no Jornal, Equipe */}
                {/* --------------------------------------------------------------- */}
                <div className="lg:col-span-5 flex flex-col justify-between space-y-2.5">
                  
                  {/* Bloco de Agendamento Moderno & Dinâmico */}
                  <div className="bg-gradient-to-b from-slate-50/90 to-slate-100/50 p-3.5 rounded-3xl border border-slate-200/90 space-y-3 shadow-xs">
                    
                    {/* Header com Ícone e Toggles em Pílula (Pill Switchers) */}
                    <div className="flex items-center justify-between gap-2 border-b border-slate-200/70 pb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                          <Clock className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-800">
                          Programação
                        </span>
                      </div>

                      {/* Pill Toggles Dinâmicos */}
                      <div className="flex items-center gap-1.5 bg-slate-200/70 p-0.5 rounded-xl border border-slate-300/40">
                        {/* Switch Dia Inteiro */}
                        <button
                          type="button"
                          onClick={() => setIsAllDay(!isAllDay)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer select-none flex items-center gap-1 ${
                            isAllDay
                              ? 'bg-white text-indigo-700 shadow-xs'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          <span>Dia Inteiro</span>
                        </button>

                        {/* Switch Tempo Indeterminado */}
                        <button
                          type="button"
                          onClick={() => {
                            const next = !isIndefinite;
                            setIsIndefinite(next);
                            if (next) setEndDate(startDate);
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer select-none flex items-center gap-1 ${
                            isIndefinite
                              ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-xs'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          <span>Indeterminado</span>
                          <span className="font-mono font-black text-xs">∞</span>
                        </button>
                      </div>
                    </div>

                    {/* Datas Início e Término em Cards Estilizados */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1 bg-white p-2 rounded-2xl border border-slate-200/80 shadow-xs">
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
                          Data de Início
                        </span>
                        <input
                          type="date"
                          required
                          value={startDate}
                          onChange={e => {
                            const val = e.target.value;
                            setStartDate(val);
                            if (isIndefinite || !endDate || endDate < val) {
                              setEndDate(val);
                            }
                          }}
                          className="w-full bg-transparent font-black text-xs text-slate-800 outline-none cursor-pointer"
                        />
                      </div>

                      <div className="space-y-1 bg-white p-2 rounded-2xl border border-slate-200/80 shadow-xs">
                        <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 block">
                          Data de Término
                        </span>
                        {isIndefinite ? (
                          <div className="flex items-center justify-between text-indigo-700 py-0.5">
                            <span className="text-[11px] font-black">Sem Término</span>
                            <span className="text-xs font-mono font-black bg-indigo-100 text-indigo-800 px-1.5 py-0.2 rounded-md">∞</span>
                          </div>
                        ) : (
                          <input
                            type="date"
                            required
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            className="w-full bg-transparent font-black text-xs text-slate-800 outline-none cursor-pointer"
                          />
                        )}
                      </div>
                    </div>

                    {/* Horários Dinâmicos com Animação (se não for dia inteiro) */}
                    <AnimatePresence>
                      {!isAllDay && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="grid grid-cols-2 gap-2 p-2 bg-indigo-50/80 rounded-2xl border border-indigo-100/90 overflow-hidden"
                        >
                          <div className="space-y-0.5">
                            <label className="text-[9px] font-black uppercase tracking-wider text-indigo-950 block">Hora Início</label>
                            <input
                              type="time"
                              required={!isAllDay}
                              value={startTime}
                              onChange={e => setStartTime(e.target.value)}
                              className="w-full px-2 py-1 rounded-xl border border-indigo-200 bg-white font-bold text-xs text-slate-800 outline-none shadow-xs"
                            />
                          </div>
                          <div className="space-y-0.5">
                            <label className="text-[9px] font-black uppercase tracking-wider text-indigo-950 block">Hora Término</label>
                            <input
                              type="time"
                              required={!isAllDay}
                              value={endTime}
                              onChange={e => setEndTime(e.target.value)}
                              className="w-full px-2 py-1 rounded-xl border border-indigo-200 bg-white font-bold text-xs text-slate-800 outline-none shadow-xs"
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Recorrência Anual com Switch Moderno */}
                    {(type !== 'Aniversário' && type !== 'Feriado Municipal') ? (
                      <div
                        onClick={() => setIsRecurring(!isRecurring)}
                        className={`flex items-center justify-between p-2.5 rounded-2xl border transition-all cursor-pointer select-none ${
                          isRecurring
                            ? 'bg-indigo-50/90 border-indigo-300 text-indigo-900 shadow-xs'
                            : 'bg-white border-slate-200/80 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <Repeat className={`w-3.5 h-3.5 ${isRecurring ? 'text-indigo-600' : 'text-slate-400'}`} />
                          <span className="text-[11px] font-bold">Repetir Anualmente</span>
                        </div>

                        {/* Switch estilo iOS */}
                        <div className={`w-8 h-4.5 flex items-center rounded-full p-0.5 transition-colors ${
                          isRecurring ? 'bg-indigo-600' : 'bg-slate-300'
                        }`}>
                          <div className={`bg-white w-3.5 h-3.5 rounded-full shadow-md transform transition-transform ${
                            isRecurring ? 'translate-x-3.5' : 'translate-x-0'
                          }`} />
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5 bg-rose-50/80 rounded-2xl border border-rose-100 flex items-center justify-between text-rose-800">
                        <div className="flex items-center gap-2">
                          <Repeat className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          <span className="text-[11px] font-bold">Recorrência Anual Automática</span>
                        </div>
                        <span className="text-[10px] font-black uppercase bg-rose-100 px-2 py-0.5 rounded-md">Ativo</span>
                      </div>
                    )}

                  </div>

                  {/* Card "Publicar no Jornal" Ultra-Moderno com IA */}
                  <div className={`p-3 rounded-3xl border transition-all ${
                    publishToNews
                      ? 'bg-gradient-to-br from-indigo-50/90 via-sky-50/80 to-indigo-50/90 border-indigo-300 shadow-sm ring-2 ring-indigo-500/15'
                      : 'bg-slate-50/80 border-slate-200/90'
                  }`}>
                    <div className="flex items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-2xl flex items-center justify-center shrink-0 transition-all ${
                          publishToNews ? 'bg-gradient-to-br from-indigo-600 to-sky-600 text-white shadow-md' : 'bg-slate-200 text-slate-600'
                        }`}>
                          <Newspaper className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-black text-slate-900 block">
                              Publicar no Jornal
                            </span>
                            <span className="px-1.5 py-0.2 rounded-md bg-indigo-100 text-indigo-800 text-[8px] font-black uppercase flex items-center gap-0.5">
                              <Sparkles className="w-2.5 h-2.5 text-indigo-600" /> IA
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-500 font-medium leading-tight">
                            Redige automaticamente a matéria institucional
                          </p>
                        </div>
                      </div>

                      {/* Switch Estilo iOS para Publicação */}
                      <div
                        onClick={() => setPublishToNews(!publishToNews)}
                        className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors cursor-pointer select-none shrink-0 ${
                          publishToNews ? 'bg-gradient-to-r from-indigo-600 to-sky-600' : 'bg-slate-300'
                        }`}
                      >
                        <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                          publishToNews ? 'translate-x-4' : 'translate-x-0'
                        }`} />
                      </div>
                    </div>

                    {publishToNews && (
                      <div className="mt-2.5 pt-2.5 border-t border-indigo-200/60 space-y-2 animate-in fade-in">
                        {/* Status da Imagem Obrigatória para o Jornal */}
                        {!imageUrl ? (
                          <div
                            onClick={() => fileInputRef.current?.click()}
                            className="p-2 rounded-2xl bg-rose-50/90 border border-rose-200 flex items-center justify-between gap-2 cursor-pointer hover:bg-rose-100/80 transition-all group"
                          >
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-lg bg-rose-500/15 text-rose-600 flex items-center justify-center shrink-0">
                                <Camera className="w-3.5 h-3.5" />
                              </div>
                              <div>
                                <p className="text-[10px] font-black text-rose-800 leading-tight">
                                  Foto Oficial Obrigatória *
                                </p>
                                <p className="text-[9px] text-rose-600/90 font-medium">
                                  Clique para anexar a foto da matéria
                                </p>
                              </div>
                            </div>
                            <span className="text-[9px] font-black uppercase tracking-wider bg-rose-600 text-white px-2 py-0.5 rounded-md shrink-0 shadow-xs group-hover:bg-rose-700">
                              Enviar Foto
                            </span>
                          </div>
                        ) : (
                          <div className="p-1.5 px-2 rounded-2xl bg-emerald-50/90 border border-emerald-200 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 truncate">
                              <div className="w-6 h-6 rounded-lg overflow-hidden border border-emerald-300 shrink-0">
                                <img src={imageUrl} alt="Foto oficial" className="w-full h-full object-cover" />
                              </div>
                              <p className="text-[10px] font-black text-emerald-800 truncate">
                                Foto oficial vinculada à matéria
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="text-[9px] font-bold text-emerald-700 hover:text-emerald-900 underline cursor-pointer shrink-0"
                            >
                              Trocar
                            </button>
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-2 pt-0.5">
                          <span className="text-[10px] font-black text-indigo-900 truncate">
                            {aiPreview ? '✨ Matéria gerada com sucesso!' : 'Geração com IA ao salvar'}
                          </span>
                          
                          <button
                            type="button"
                            onClick={handleGeneratePreviewAI}
                            disabled={isGeneratingAI}
                            className="px-2.5 py-1 bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-700 hover:to-sky-700 text-white rounded-xl text-[10px] font-black transition-all flex items-center gap-1 shadow-xs active:scale-95 cursor-pointer disabled:opacity-50 shrink-0"
                          >
                            {isGeneratingAI ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Wand2 className="w-3 h-3" />
                            )}
                            <span>{aiPreview ? 'Ver Matéria' : 'Prévia com IA'}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card de Convidados Minimalista & Moderno */}
                  <div className="p-3 bg-slate-50/80 rounded-3xl border border-slate-200/90 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black shrink-0">
                        <Users className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <span className="text-xs font-extrabold text-slate-800 block">
                          {selectedInvites.length === 0
                            ? 'Nenhum convidado vinculado'
                            : `${selectedInvites.length} participante(s)`}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">Agenda compartilhada</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('invites')}
                      className="px-3 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 hover:text-indigo-600 rounded-xl text-[11px] font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                    >
                      Gerenciar
                    </button>
                  </div>

                </div>

              </form>
            ) : (
              /* ABA DE CONVIDADOS */
              <div className="flex flex-col h-full justify-between space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase">
                      Participantes & Equipe
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      O evento será adicionado às agendas dos selecionados
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={selectAll}
                    className="px-3.5 py-1.5 text-xs font-black text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors cursor-pointer"
                  >
                    {selectedInvites.length === allUsers.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 flex-1 overflow-y-auto custom-scrollbar pr-1">
                  {allUsers.map(user => {
                    const invite = selectedInvites.find(i => i.user_id === user.id);
                    const isSelected = !!invite;

                    return (
                      <div
                        key={user.id}
                        className={`flex items-center justify-between p-3 border rounded-2xl transition-all ${
                          isSelected
                            ? 'border-indigo-300 bg-indigo-50/70 shadow-xs'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div
                          className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0"
                          onClick={() => toggleInvite(user.id)}
                        >
                          <div className={`shrink-0 ${isSelected ? 'text-indigo-600' : 'text-slate-300'}`}>
                            {isSelected ? <CheckSquare className="w-4.5 h-4.5" /> : <Square className="w-4.5 h-4.5" />}
                          </div>
                          <span className={`text-xs truncate ${isSelected ? 'text-indigo-950 font-black' : 'text-slate-700 font-bold'}`}>
                            {user.name}
                          </span>
                        </div>

                        {isSelected && (
                          <select
                            value={invite.role}
                            onChange={(e) => setRole(user.id, e.target.value as 'Colaborador' | 'Participante')}
                            className="text-[9px] font-black bg-white border border-indigo-200 text-indigo-700 rounded-lg px-1.5 py-0.5 outline-none ml-1.5 shrink-0 cursor-pointer"
                          >
                            <option value="Participante">Participante</option>
                            <option value="Colaborador">Organizador</option>
                          </select>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Footer de Ações Moderno */}
          <div className="px-6 py-3 bg-slate-50/90 border-t border-slate-200/90 flex items-center justify-between shrink-0">
            {eventToEdit ? (
              <button
                type="button"
                onClick={() => setIsConfirmDeleteOpen(true)}
                disabled={deleting || loading}
                className="flex items-center gap-1.5 px-3 py-2 text-rose-600 hover:bg-rose-100 rounded-xl font-bold uppercase tracking-wider text-[11px] transition-colors cursor-pointer"
              >
                {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                <span>Excluir</span>
              </button>
            ) : <div />}

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-xl font-bold uppercase tracking-wider text-xs transition-all cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="submit"
                form="event-form"
                onClick={(e) => activeTab === 'invites' && handleSave(e)}
                disabled={loading || deleting}
                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-rose-500 via-pink-600 to-rose-600 hover:from-rose-600 hover:to-pink-700 text-white rounded-xl shadow-lg shadow-rose-500/20 font-black uppercase tracking-wider text-xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>
                  {publishToNews
                    ? 'Salvar & Publicar no Jornal'
                    : eventToEdit
                    ? 'Atualizar Registro'
                    : 'Salvar Registro'}
                </span>
              </button>
            </div>
          </div>

        </motion.div>

        {/* Modal de Prévia da Matéria Gerada por IA */}
        {showAiPreviewModal && aiPreview && (
          <div className="fixed inset-0 z-[2700] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
            <div className="bg-white rounded-[2rem] p-6 sm:p-8 max-w-2xl w-full space-y-4 shadow-2xl border border-slate-200 max-h-[85vh] overflow-y-auto custom-scrollbar font-serif">
              
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 font-sans">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded bg-indigo-100 text-indigo-800 text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-indigo-600" /> Redação IA • {aiPreview.categoria}
                  </span>
                  <span className="text-xs text-slate-400 font-bold">• Jornal Oficial</span>
                </div>
                <button
                  onClick={() => setShowAiPreviewModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {imageUrl && (
                <div className="w-full h-44 rounded-2xl overflow-hidden shadow-md">
                  <img src={imageUrl} alt="Imagem da Matéria" className="w-full h-full object-cover" />
                </div>
              )}

              {/* Manchete */}
              <h2 className="text-2xl sm:text-3xl font-serif font-black text-slate-950 leading-tight">
                {aiPreview.manchete}
              </h2>

              {/* Lead */}
              <p className="text-base font-serif text-slate-700 italic border-l-4 border-indigo-600 pl-4 py-1 leading-relaxed">
                "{aiPreview.subtitulo}"
              </p>

              {/* Corpo */}
              <div className="text-sm font-serif text-slate-700 leading-relaxed space-y-3 whitespace-pre-line">
                {aiPreview.corpo}
              </div>

              {/* Aspas / Destaque */}
              {aiPreview.destaqueFrase && (
                <blockquote className="p-3.5 bg-indigo-50/70 border-l-4 border-indigo-500 rounded-r-2xl text-xs font-serif italic text-indigo-950">
                  {aiPreview.destaqueFrase}
                </blockquote>
              )}

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between font-sans">
                <span className="text-xs text-slate-400 font-semibold">
                  Autoria: <strong>Assessoria de Comunicação Oficial</strong>
                </span>
                <button
                  onClick={() => setShowAiPreviewModal(false)}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-xs cursor-pointer shadow"
                >
                  Aprovar Matéria
                </button>
              </div>

            </div>
          </div>
        )}

        {/* Modal de Confirmação de Exclusão */}
        {isConfirmDeleteOpen && (
          <div className="fixed inset-0 z-[2600] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md animate-fade-in">
            <div className="bg-white rounded-[2rem] p-6 max-w-sm w-full space-y-4 shadow-2xl border border-slate-100 text-center font-sans">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-inner">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-black text-slate-900 uppercase">Excluir Compromisso?</h3>
              <p className="text-xs text-slate-500 font-medium">
                Tem certeza que deseja remover este registro do calendário?
              </p>
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={() => setIsConfirmDeleteOpen(false)}
                  className="flex-1 py-2.5 text-slate-600 hover:bg-slate-100 font-bold text-xs uppercase tracking-wider rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-rose-500/20 active:scale-95 transition-all"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AnimatePresence>
  );
};
