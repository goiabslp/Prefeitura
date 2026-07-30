import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ArrowLeft, MapPin, Calendar, Clock, FileText, CheckCircle2, 
  Loader2, Search, ChevronDown, Users, X, Check, ChevronLeft,
  MessageSquare, ArrowRight, ChevronRight, Car, AlertTriangle,
  Bed, Plus, Minus, Trash2, Mic, MicOff, Sparkles, Wand2, Info
} from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO, addMinutes, addHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Person, User, Sector, Job, Vehicle, DiariaEvento } from '../../types';
import { createDiariaEvento, getDiariasGestores, getAllDiariaEventos } from '../../services/diariasEventosService';
import { useCachedVehicles } from '../../hooks/useCachedVehicles';
import { supabase } from '../../services/supabaseClient';
import { polishMotivoWithAI } from '../../services/geminiService';
import { motion, AnimatePresence } from 'framer-motion';


const DateTimePickerModal = ({ 
  isOpen, 
  onClose, 
  onSelect, 
  initialValue, 
  title,
  isAdmin = false
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onSelect: (val: string) => void, 
  initialValue: string, 
  title: string,
  isAdmin?: boolean
}) => {
  const getMinAllowed = () => {
    const d = new Date();
    d.setSeconds(0, 0);
    return addMinutes(d, 30);
  };

  const [currentMonth, setCurrentMonth] = useState(() => initialValue ? parseISO(initialValue) : new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => {
    if (initialValue) {
      const parsed = parseISO(initialValue);
      if (!isAdmin && parsed.getTime() < getMinAllowed().getTime()) {
        return getMinAllowed();
      }
      return parsed;
    }
    return new Date();
  });

  const [time, setTime] = useState(() => {
    if (initialValue) {
      const d = parseISO(initialValue);
      const minDt = getMinAllowed();
      if (!isAdmin && d.getTime() < minDt.getTime()) {
        return format(minDt, "HH:mm");
      }
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
    return format(getMinAllowed(), "HH:mm");
  });

  useEffect(() => {
    if (isOpen) {
      const minDt = getMinAllowed();
      if (initialValue) {
        const parsed = parseISO(initialValue);
        setCurrentMonth(parsed);
        if (!isAdmin && parsed.getTime() < minDt.getTime()) {
          setSelectedDate(minDt);
          setTime(format(minDt, "HH:mm"));
        } else {
          setSelectedDate(parsed);
          setTime(`${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`);
        }
      } else {
        const now = new Date();
        setSelectedDate(now);
        setCurrentMonth(now);
        setTime(format(minDt, "HH:mm"));
      }
    }
  }, [isOpen, initialValue, isAdmin]);

  if (!isOpen) return null;

  const minAllowed = getMinAllowed();
  const getTargetDateTime = () => {
    if (!selectedDate) return null;
    const [hours, minutes] = time.split(':').map(Number);
    const dt = new Date(selectedDate);
    dt.setHours(hours || 0, minutes || 0, 0, 0);
    return dt;
  };

  const targetDateTime = getTargetDateTime();
  const isTimeTooSoon = !isAdmin && targetDateTime ? targetDateTime.getTime() < minAllowed.getTime() : false;

  const handleDateClick = (d: Date) => {
    setSelectedDate(d);
    if (!isAdmin && isSameDay(d, new Date())) {
      const [h, m] = time.split(':').map(Number);
      const checkDt = new Date(d);
      checkDt.setHours(h || 0, m || 0, 0, 0);
      const minDt = getMinAllowed();
      if (checkDt.getTime() < minDt.getTime()) {
        setTime(format(minDt, "HH:mm"));
      }
    }
  };

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const startDay = startOfMonth(currentMonth).getDay();
  const paddingDays = Array.from({ length: startDay }).map((_, i) => i);

  const handleConfirm = () => {
     if (!selectedDate || isTimeTooSoon) return;
     const [hours, minutes] = time.split(':').map(Number);
     const finalDate = new Date(selectedDate);
     finalDate.setHours(hours, minutes, 0, 0);
     
     const formatted = finalDate.toISOString();
     onSelect(formatted);
     onClose();
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto animate-fade-in" onClick={onClose}>
       <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
           <div className="bg-indigo-600 p-5 text-white text-center relative shrink-0">
               <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-200 mb-1">{title}</h3>
               <div className="text-2xl sm:text-3xl font-black tracking-tight">
                  {selectedDate ? format(selectedDate, "dd 'de' MMM", { locale: ptBR }) : 'Selecione'}
               </div>
               <div className="text-base font-semibold text-indigo-200 mt-0.5">
                  {time} hs
               </div>
               <button onClick={onClose} className="absolute top-4 right-4 p-2 text-indigo-200 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors">
                 <X className="w-5 h-5" />
               </button>
           </div>
           
           <div className="p-4 sm:p-6 space-y-4 sm:space-y-5 overflow-y-auto min-h-0 flex-1">
              <div className="flex items-center justify-between">
                 <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1.5 hover:bg-slate-100 rounded-full text-slate-600 transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                 </button>
                 <span className="font-bold text-slate-800 text-sm capitalize">
                    {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
                 </span>
                 <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1.5 hover:bg-slate-100 rounded-full text-slate-600 transition-colors">
                    <ChevronRight className="w-5 h-5" />
                 </button>
              </div>

              <div>
                 <div className="grid grid-cols-7 gap-1 mb-1">
                    {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                       <div key={i} className="text-center text-[10px] font-bold text-slate-400">{d}</div>
                    ))}
                 </div>
                 <div className="grid grid-cols-7 gap-1">
                    {paddingDays.map(i => <div key={`pad-${i}`} />)}
                    {days.map(d => {
                       const isSelected = selectedDate && isSameDay(d, selectedDate);
                       const isToday = isSameDay(d, new Date());
                       const now = new Date();
                       const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                       const dayOnly = new Date(d.getFullYear(), d.getMonth(), d.getDate());
                       const isPast = !isAdmin && dayOnly.getTime() < today.getTime();

                       return (
                         <button
                           key={d.toISOString()}
                           disabled={isPast}
                           onClick={() => handleDateClick(d)}
                           className={`w-7 h-7 sm:w-8 sm:h-8 mx-auto flex items-center justify-center rounded-full text-xs sm:text-sm transition-all ${
                             isPast ? 'opacity-25 cursor-not-allowed pointer-events-none text-slate-300' :
                             isSelected ? 'bg-indigo-600 text-white font-bold shadow-md scale-105' :
                             isToday ? 'bg-indigo-50 text-indigo-600 font-bold' :
                             'text-slate-700 hover:bg-slate-100 font-medium'
                           }`}
                         >
                           {format(d, 'd')}
                         </button>
                       );
                    })}
                 </div>
              </div>

              <div className="pt-3 border-t border-slate-100 flex flex-col items-center gap-2">
                 <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Horário</label>
                 
                 <div className="flex items-center justify-center gap-2 w-full">
                   {/* Hora */}
                   <div className="flex flex-col items-center flex-1 max-w-[100px]">
                     <span className="text-[9px] font-bold text-slate-400 uppercase mb-1">Hora</span>
                     <select
                       value={time.split(':')[0] || '08'}
                       onChange={e => {
                         const mins = time.split(':')[1] || '00';
                         setTime(`${e.target.value}:${mins}`);
                       }}
                       className="w-full text-base font-black text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-center cursor-pointer shadow-xs"
                     >
                       {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map(h => (
                         <option key={h} value={h}>{h} h</option>
                       ))}
                     </select>
                   </div>

                   <span className="text-xl font-black text-slate-400 pt-3">:</span>

                   {/* Minutos */}
                   <div className="flex flex-col items-center flex-1 max-w-[100px]">
                     <span className="text-[9px] font-bold text-slate-400 uppercase mb-1">Minuto</span>
                     <select
                       value={time.split(':')[1] || '00'}
                       onChange={e => {
                         const hrs = time.split(':')[0] || '08';
                         setTime(`${hrs}:${e.target.value}`);
                       }}
                       className="w-full text-base font-black text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-center cursor-pointer shadow-xs"
                     >
                       {Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0')).map(m => (
                         <option key={m} value={m}>{m} min</option>
                       ))}
                     </select>
                   </div>
                 </div>

                 {isTimeTooSoon && (
                   <div className="p-2.5 bg-amber-50 border border-amber-200/80 rounded-xl text-center text-amber-900 text-[11px] font-bold flex items-center justify-center gap-1.5 w-full mt-1 animate-fade-in">
                     <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                     <span>Antecedência mínima de 30 min (mínimo: {format(minAllowed, "HH:mm")} hs)</span>
                   </div>
                 )}
              </div>

              <button 
                 onClick={handleConfirm}
                 disabled={!selectedDate || !time || isTimeTooSoon}
                 className="w-full py-3 bg-slate-900 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg hover:bg-slate-800 hover:shadow-xl active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0 mt-2"
              >
                 Confirmar Data e Hora
              </button>
           </div>
       </div>
    </div>
  );
};

interface NovoEventoScreenProps {
  currentUser: User | null;
  persons: Person[];
  sectors: Sector[];
  jobs: Job[];
  onBack: () => void;
  onFinish?: () => void;
}

interface IBGECity {
  nome: string;
  microrregiao?: {
    mesorregiao?: {
      UF?: {
        sigla?: string;
      }
    }
  }
}

const FALLBACK_CITIES = [
  'SÃO JOSÉ DO GOIABAL - MG', 'JOÃO MONLEVADE - MG', 'BELO HORIZONTE - MG',
  'IPATINGA - MG', 'ITABIRA - MG', 'ALVINÓPOLIS - MG', 'RIO PIRACICABA - MG',
  'PONTE NOVA - MG', 'DOM SILVÉRIO - MG', 'DIONÍSIO - MG', 'SÃO DOMINGOS DO PRATA - MG',
  'RAUL SOARES - MG', 'NOVA ERA - MG', 'CARATINGA - MG', 'TIMÓTEO - MG'
];

export const NovoEventoScreen: React.FC<NovoEventoScreenProps> = ({
  currentUser,
  persons,
  sectors,
  jobs,
  onBack,
  onFinish
}) => {
  const normalizeName = (n: string) => {
    return n.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  };

  const [selectedPersons, setSelectedPersons] = useState<{ id: string; name: string }[]>(() => {
    if (currentUser) {
      const match = persons.find(p => normalizeName(p.name) === normalizeName(currentUser.name));
      if (match) return [{ id: match.id, name: match.name }];
      return [{ id: currentUser.id, name: currentUser.name }];
    }
    return [];
  });
  const [editingPersonIndex, setEditingPersonIndex] = useState<number | null>(null);
  const [overrideVehicleConflict, setOverrideVehicleConflict] = useState<string | null>(null);
  const [destination, setDestination] = useState('');
  const [departureDateTime, setDepartureDateTime] = useState('');
  const [returnDateTime, setReturnDateTime] = useState('');
  const [reason, setReason] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isPolishingAI, setIsPolishingAI] = useState(false);
  const recognitionRef = useRef<any>(null);
  
  const isLastActionPolishRef = useRef(false);
  const lastPolishedTextRef = useRef('');
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const polishWithAI = async (textToPolish: string) => {
    if (!textToPolish || textToPolish.trim().length < 15) return;
    if (textToPolish.trim() === lastPolishedTextRef.current.trim()) return;

    setIsPolishingAI(true);
    try {
      const polishedText = await polishMotivoWithAI(textToPolish);
      if (polishedText) {
        lastPolishedTextRef.current = polishedText;
        isLastActionPolishRef.current = true;
        setReason(polishedText);
      }
    } catch (e) {
      console.warn('Erro ao lapidar motivo automaticamente:', e);
    } finally {
      setIsPolishingAI(false);
    }
  };

  useEffect(() => {
    if (isLastActionPolishRef.current) {
      isLastActionPolishRef.current = false;
      return;
    }

    if (isRecording || isPolishingAI) return;
    if (reason.trim().length < 15) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      polishWithAI(reason);
    }, 2500);

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [reason, isRecording]);

  // Estados para status de alocação de veículos e modal dinâmico de situação
  const [diariaEvents, setDiariaEvents] = useState<DiariaEvento[]>([]);
  const [vehicleStatusModal, setVehicleStatusModal] = useState<{
    vehicleName: string;
    plate: string;
    statusKey: 'em_viagem' | 'viagem_programada' | 'aguardando_aprovacao';
    statusLabel: string;
    badgeClass: string;
    evento?: DiariaEvento;
  } | null>(null);

  useEffect(() => {
    const fetchDiariaEvents = async () => {
      try {
        const events = await getAllDiariaEventos();
        setDiariaEvents(events);
      } catch (e) {
        console.warn('Erro ao carregar eventos de diárias:', e);
      }
    };
    fetchDiariaEvents();
  }, []);

  const getVehicleStatusInfo = (vehicle: Vehicle) => {
    const normalize = (str: string) => str ? str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() : "";
    const vPlate = normalize(vehicle.plate);
    const vBrandModel = normalize(`${vehicle.brand} ${vehicle.model}`);

    const activeEvt = diariaEvents.find(evt => {
      if (evt.status === 'concluido' || evt.status === 'cancelado' || evt.status === 'rejeitado_gestor' || evt.status === 'rejeitado_administrador') {
        return false;
      }
      const evtVeiculoStr = normalize(typeof evt.veiculo === 'string' ? evt.veiculo : (evt.veiculo as any)?.plate || (evt.veiculo as any)?.model || '');
      if (!evtVeiculoStr) return false;

      const isSameVehicle = (vPlate && evtVeiculoStr.includes(vPlate)) || (vBrandModel && evtVeiculoStr.includes(vBrandModel));
      if (!isSameVehicle) return false;

      // Validação de interseção de períodos
      if (departureDateTime) {
        try {
          const novaSaida = parseISO(departureDateTime);
          const novaRetorno = returnDateTime ? parseISO(returnDateTime) : addHours(novaSaida, 4);

          const evtSaida = evt.data_saida ? parseISO(evt.data_saida) : null;
          const evtRetorno = evt.data_retorno ? parseISO(evt.data_retorno) : (evtSaida ? addHours(evtSaida, 4) : null);

          if (evtSaida && evtRetorno) {
            // Se houver sobreposição, o veículo fica indisponível para este período
            const hasOverlap = (novaSaida.getTime() < evtRetorno.getTime()) && (novaRetorno.getTime() > evtSaida.getTime());
            return hasOverlap;
          }
        } catch (e) {
          console.warn("Erro ao processar as datas na validação de disponibilidade:", e);
        }
      }

      return false;
    });

    if (!activeEvt) {
      return {
        isAvailable: true,
        statusKey: 'disponivel',
        statusLabel: 'Disponível',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-300'
      };
    }

    if (activeEvt.status === 'em_viagem') {
      return {
        isAvailable: false,
        statusKey: 'em_viagem',
        statusLabel: 'Em Viagem',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-300',
        evento: activeEvt
      };
    }

    if (activeEvt.status === 'viagem_programada') {
      return {
        isAvailable: false,
        statusKey: 'viagem_programada',
        statusLabel: 'Viagem Programada',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-300',
        evento: activeEvt
      };
    }

    return {
      isAvailable: false,
      statusKey: 'aguardando_aprovacao',
      statusLabel: 'Aguardando Aprovação',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-300',
      evento: activeEvt
    };
  };

  const startRecordingSpeech = () => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('O reconhecimento de voz não é suportado pelo seu navegador neste dispositivo. Tente no Google Chrome, Edge ou Safari.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript.trim()) {
          setReason(transcript);
        }
      };

      recognition.onerror = (event: any) => {
        console.warn('Erro no reconhecimento de voz:', event.error);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.error(e);
      setIsRecording(false);
    }
  };

  const stopRecordingAndPolish = async () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    setIsRecording(false);

    if (reason && reason.trim().length > 3) {
      setIsPolishingAI(true);
      try {
        const polishedText = await polishMotivoWithAI(reason);
        if (polishedText) {
          lastPolishedTextRef.current = polishedText;
          isLastActionPolishRef.current = true;
          setReason(polishedText);
        }
      } catch (e) {
        console.warn(e);
      } finally {
        setIsPolishingAI(false);
      }
    }
  };

  const handleToggleMic = () => {
    if (isRecording) {
      stopRecordingAndPolish();
    } else {
      startRecordingSpeech();
    }
  };

  const handleManualPolishing = async () => {
    if (!reason || !reason.trim()) return;
    setIsPolishingAI(true);
    try {
      const polishedText = await polishMotivoWithAI(reason);
      if (polishedText) {
        lastPolishedTextRef.current = polishedText;
        isLastActionPolishRef.current = true;
        setReason(polishedText);
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setIsPolishingAI(false);
    }
  };

  const [isExpiredModalOpen, setIsExpiredModalOpen] = useState(false);
  const [dateValidationError, setDateValidationError] = useState<{
    title: string;
    message: string;
    law?: string;
  } | null>(null);
  const [isReasonMaximized, setIsReasonMaximized] = useState(false);

  const [isMobile, setIsMobile] = useState(false);
  const [mobileStep, setMobileStep] = useState(1);
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const checkActiveTrip = async () => {
      if (!currentUser) return;
      try {
        const { getAllDiariaEventos } = await import('../../services/diariasEventosService');
        const allEvts = await getAllDiariaEventos();
        const active = allEvts.find(evt => {
          if (!evt.pessoas || !Array.isArray(evt.pessoas)) return false;
          const p = evt.pessoas.find(x => x.id === currentUser.id || (x.name && normalizeName(x.name) === normalizeName(currentUser.name)));
          return p && (p as any).viagem_inicio && !(p as any).viagem_fim;
        });
        if (active) {
          window.history.pushState({}, '', `/Diarias/Viajar/Detalhes?id=${active.id}`);
          window.dispatchEvent(new Event('popstate'));
        }
      } catch (e) {}
    };
    checkActiveTrip();
  }, [currentUser]);

  const [gestoresMap, setGestoresMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchGestoresMap = async () => {
      try {
        const gList = await getDiariasGestores();
        const map: Record<string, string> = {};
        gList.forEach(g => { map[g.pessoa_id] = g.gestor_id; });
        setGestoresMap(map);
      } catch (e) {
        console.warn("Erro ao buscar gestores em NovoEventoScreen:", e);
      }
    };
    fetchGestoresMap();
  }, []);

  const isGestorOrAdmin = useMemo(() => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    if (currentUser.permissions?.includes('parent_diarias_gestores')) return true;
    return Object.values(gestoresMap).includes(currentUser.id);
  }, [currentUser, gestoresMap]);

  const shouldShowHospedagem = useMemo(() => {
    if (!departureDateTime || !returnDateTime) return false;
    try {
      const dep = parseISO(departureDateTime);
      const ret = parseISO(returnDateTime);
      const diffMs = ret.getTime() - dep.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      return diffHours >= 12;
    } catch (e) {
      return false;
    }
  }, [departureDateTime, returnDateTime]);

  useEffect(() => {
    if (!shouldShowHospedagem) {
      setHospedagem(false);
      setHospedagemDias(0);
    }
  }, [shouldShowHospedagem]);

  const canAddExtraServer = useMemo(() => {
    if (!currentUser) return false;
    return currentUser.role === 'admin';
  }, [currentUser]);

  const isDateExpired = (returnDateStr: string): boolean => {
    if (!returnDateStr) return false;
    try {
      const returnDate = parseISO(returnDateStr);
      const now = new Date();
      
      const retDay = new Date(returnDate.getFullYear(), returnDate.getMonth(), returnDate.getDate());
      const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      const diffMs = nowDay.getTime() - retDay.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      return diffDays > 10;
    } catch (e) {
      return false;
    }
  };

  const handleDepartureSelect = (val: string) => {
    setOverrideVehicleConflict(null);
    if (!val) {
      setDepartureDateTime('');
      return;
    }

    const isAdmin = currentUser && currentUser.role === 'admin';
    const selectedDateTime = parseISO(val);

    // 1. Regra absoluta: Validar se a data de saída é posterior à data de retorno (se o retorno já estiver definido)
    if (returnDateTime) {
      const retDateTime = parseISO(returnDateTime);
      if (selectedDateTime.getTime() > retDateTime.getTime()) {
        setDateValidationError({
          title: "Conflito de Cronograma",
          message: "A data de saída selecionada é posterior à data de retorno definida para esta viagem.",
          law: `Saída sugerida: ${format(selectedDateTime, "dd/MM/yyyy HH:mm")} • Retorno definido: ${format(retDateTime, "dd/MM/yyyy HH:mm")}`
        });
        return;
      }
    }

    // 2. Regras restritas para usuários comuns (Administradores têm permissão exclusiva para retroativos):
    if (!isAdmin) {
      const now = new Date();
      now.setSeconds(0, 0);
      const minAllowed = addMinutes(now, 30);
      if (selectedDateTime.getTime() < minAllowed.getTime()) {
        setDateValidationError({
          title: "Horário de Saída Inválido",
          message: "Não é permitido realizar viagens com a hora ou data ultrapassada. O horário de saída deve ser de no mínimo 30 minutos a partir do horário atual.",
          law: `Data/Hora selecionada: ${format(selectedDateTime, "dd/MM/yyyy HH:mm")} • Mínimo permitido: ${format(minAllowed, "dd/MM/yyyy HH:mm")}. Lançamentos retroativos são de permissão exclusiva da administração.`
        });
        return;
      }
    }

    setDepartureDateTime(val);
  };

  const handleReturnSelect = (val: string) => {
    setOverrideVehicleConflict(null);
    if (!val) {
      setReturnDateTime('');
      return;
    }

    const isAdmin = currentUser && currentUser.role === 'admin';
    const selectedReturnDateTime = parseISO(val);

    // 1. Regra absoluta: Validar se o retorno é anterior à saída (se a saída já estiver definida)
    if (departureDateTime) {
      const depDateTime = parseISO(departureDateTime);
      if (selectedReturnDateTime.getTime() < depDateTime.getTime()) {
        setDateValidationError({
          title: "Data de Retorno Inválida",
          message: "Não é permitido definir uma data de retorno anterior à data e horário de saída da viagem.",
          law: `Saída definida: ${format(depDateTime, "dd/MM/yyyy HH:mm")} • Retorno sugerido: ${format(selectedReturnDateTime, "dd/MM/yyyy HH:mm")}`
        });
        return;
      }
    }

    // 2. Regras restritas para usuários comuns (Administradores têm permissão exclusiva para retroativos):
    if (!isAdmin) {
      const now = new Date();
      if (selectedReturnDateTime.getTime() < now.getTime()) {
        setDateValidationError({
          title: "Data e Hora de Retorno Inválidas",
          message: "Não é permitido selecionar data e hora de retorno anteriores à data e hora atual.",
          law: `Data e Hora selecionada: ${format(selectedReturnDateTime, "dd/MM/yyyy HH:mm")} • Data e Hora atual: ${format(now, "dd/MM/yyyy HH:mm")}. Lançamentos retroativos são de permissão exclusiva da administração.`
        });
        return;
      }

      if (isDateExpired(val)) {
        setReturnDateTime('');
        setIsExpiredModalOpen(true);
        return;
      }
    }

    setReturnDateTime(val);
  };

  // Novos campos adicionados
  const { data: cachedVehicles = [] } = useCachedVehicles();
  const [directVehicles, setDirectVehicles] = useState<Vehicle[]>([]);
  const vehicles = directVehicles.length > 0 ? directVehicles : cachedVehicles;

  useEffect(() => {
    const loadVehiclesDirectly = async () => {
      try {
        const { data, error } = await supabase
          .from('vehicles')
          .select('*')
          .order('plate', { ascending: true });
        if (data && !error) {
          setDirectVehicles(data);
        }
      } catch (e) {
        console.warn("Direct vehicle loading failed:", e);
      }
    };
    loadVehiclesDirectly();
  }, []);

  const [hospedagem, setHospedagem] = useState(false);
  const [hospedagemDias, setHospedagemDias] = useState<number>(1);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [customVehicle, setCustomVehicle] = useState('');
  const [distancia, setDistancia] = useState<number | ''>('');
  const [isCalculatingDistance, setIsCalculatingDistance] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const [currentStep, setCurrentStep] = useState(1);
  
  // Handlers para gerenciar múltiplos servidores na mesma viagem
  const handleAddPerson = () => {
    setEditingPersonIndex(null);
    setIsPersonsOpen(true);
  };

  const handleRemovePerson = (index: number) => {
    if (selectedPersons.length <= 1) return;
    setSelectedPersons(prev => prev.filter((_, i) => i !== index));
  };

  const handleSelectPerson = (person: { id: string; name: string }) => {
    if (editingPersonIndex !== null && editingPersonIndex < selectedPersons.length) {
      setSelectedPersons(prev => {
        const updated = [...prev];
        updated[editingPersonIndex] = person;
        return updated;
      });
    } else {
      setSelectedPersons(prev => {
        if (prev.some(p => p.id === person.id)) return prev;
        return [...prev, person];
      });
    }
    setIsPersonsOpen(false);
    setPersonSearch('');
    setEditingPersonIndex(null);
  };

  const isOutroServidor = selectedPersons.some(p => currentUser && p.id !== currentUser.id);

  const isStep1Valid = selectedPersons.length > 0 &&
    selectedPersons.every(p => p && p.id && p.name) &&
    destination && 
    departureDateTime && 
    (!returnDateTime || !isDateExpired(returnDateTime) || isGestorOrAdmin) &&
    (selectedVehicle !== '' && (selectedVehicle !== 'OUTRO' || customVehicle.trim() !== '')) &&
    (selectedVehicle === '' || selectedVehicle === 'OUTRO' || (() => {
      const v = vehicles.find(veh => `${veh.brand} ${veh.model} - ${veh.plate}` === selectedVehicle);
      return v ? (getVehicleStatusInfo(v).isAvailable || overrideVehicleConflict === v.id) : true;
    })()) &&
    (!hospedagem || (hospedagem && hospedagemDias > 0)) &&
    distancia !== '';
  
  // States for city modal
  const [cities, setCities] = useState<string[]>([]);
  const [isCityLoading, setIsCityLoading] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [isCityOpen, setIsCityOpen] = useState(false);

  // States for vehicles modal
  const [isVehiclesOpen, setIsVehiclesOpen] = useState(false);
  const [vehicleSearch, setVehicleSearch] = useState('');

  // States for persons single-select modal
  const [isPersonsOpen, setIsPersonsOpen] = useState(false);
  const [personSearch, setPersonSearch] = useState('');

  // States for date modals
  const [activeDateModal, setActiveDateModal] = useState<'departure' | 'return' | null>(null);

  useEffect(() => {
    if (currentUser && persons.length > 0 && selectedPersons.length === 0) {
      const match = persons.find(p => normalizeName(p.name) === normalizeName(currentUser.name));
      if (match) {
        setSelectedPersons([{ id: match.id, name: match.name }]);
      }
    }
  }, [persons, currentUser]);

  useEffect(() => {
    const fetchCities = async () => {
      setIsCityLoading(true);
      try {
        const response = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome');
        if (!response.ok) throw new Error("Erro na resposta da API");
        const data: IBGECity[] = await response.json();
        const formattedCities = data
          .map(city => {
            const uf = city.microrregiao?.mesorregiao?.UF?.sigla;
            if (city.nome && uf) {
              return `${city.nome.toUpperCase()} - ${uf}`;
            }
            return null;
          })
          .filter((city): city is string => city !== null);
        setCities(formattedCities);
      } catch (error) {
        setCities(FALLBACK_CITIES);
      } finally {
        setIsCityLoading(false);
      }
    };
    fetchCities();
  }, []);

  const getGoogleMapsRouteUrl = () => {
    if (!destination) return '';
    const destClean = destination.split(' - ')[0];
    return `https://www.google.com/maps/dir/${encodeURIComponent('São José do Goiabal, MG')}/${encodeURIComponent(destClean)}`;
  };  const calculateDistance = async (destinationCity: string) => {
    try {
      if (!destinationCity) {
        setDistancia('');
        return;
      }
      setIsCalculatingDistance(true);
      
      const destName = destinationCity.split(' - ')[0].toUpperCase();
      const originName = "SÃO JOSÉ DO GOIABAL";
      
      let distVal = 0;

      if (destName === originName) {
         distVal = 0;
      } else {
        // Distâncias pré-definidas de apenas IDA
        const predefined: Record<string, number> = {
          'JOÃO MONLEVADE': 76,
          'BELO HORIZONTE': 182,
          'IPATINGA': 82,
          'ITABIRA': 105,
          'ALVINÓPOLIS': 69,
          'RIO PIRACICABA': 73,
          'PONTE NOVA': 77,
          'DOM SILVÉRIO': 55,
          'DIONÍSIO': 15,
          'SÃO DOMINGOS DO PRATA': 61,
          'RAUL SOARES': 73,
          'NOVA ERA': 80,
          'CARATINGA': 142,
          'TIMÓTEO': 59,
          'CORONEL FABRICIANO': 69
        };

        if (predefined[destName] !== undefined) {
           distVal = predefined[destName];
        } else {
          let calculated = false;
          const googleMapsApiKey = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '';
          
          // 1. Tenta calcular via Google Maps Distance Matrix se a API Key estiver configurada
          if (googleMapsApiKey) {
            try {
              const res = await fetch(`https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent('São José do Goiabal, MG')}&destinations=${encodeURIComponent(destName + ', MG, Brazil')}&key=${googleMapsApiKey}`);
              const data = await res.json();
              if (data.rows && data.rows[0]?.elements[0]?.status === 'OK') {
                const distanceMeters = data.rows[0].elements[0].distance.value;
                // Distância de apenas IDA
                distVal = Math.round(distanceMeters / 1000);
                calculated = true;
              }
            } catch (err) {
              console.warn('Google Maps Distance Matrix failed, falling back to OSRM:', err);
            }
          }

          // 2. Fallback para OSRM (Calculador de rota de carro de estrada real gratuito)
          if (!calculated) {
            const fetchCoords = async (cityStr: string) => {
               const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityStr + ', Minas Gerais, Brazil')}`);
               const data = await res.json();
               if (data && data.length > 0) {
                  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) };
               }
               return null;
            };

            const originCoords = await fetchCoords(originName);
            const destCoords = await fetchCoords(destName);

            if (originCoords && destCoords) {
               const osrmRes = await fetch(`https://router.project-osrm.org/route/v1/driving/${originCoords.lon},${originCoords.lat};${destCoords.lon},${destCoords.lat}?overview=false`);
               const osrmData = await osrmRes.json();
               if (osrmData.routes && osrmData.routes.length > 0) {
                  const distanceMeters = osrmData.routes[0].distance;
                  // Distância de apenas IDA
                  distVal = Math.round(distanceMeters / 1000);
               }
            }
          }
        }
      }

      setDistancia(distVal);
    } catch (e) {
      console.warn('Failed to calculate distance automatically:', e);
    } finally {
      setIsCalculatingDistance(false);
    }
  };

  useEffect(() => {
    calculateDistance(destination);
  }, [destination]);

  const normalizeText = (text: string) => {
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]|_/g, "").toLowerCase();
  };

  const saveRecentDestination = (city: string) => {
    if (!city) return;
    try {
      const stored = localStorage.getItem('recent_destinations');
      let recents: string[] = stored ? JSON.parse(stored) : [];
      recents = recents.filter(c => c !== city);
      recents.unshift(city);
      recents = recents.slice(0, 3);
      localStorage.setItem('recent_destinations', JSON.stringify(recents));
    } catch (e) {
      console.warn("Falha ao salvar destino recente no localStorage:", e);
    }
  };

  const recentDestinationsList = useMemo(() => {
    try {
      const stored = localStorage.getItem('recent_destinations');
      return stored ? (JSON.parse(stored) as string[]) : [];
    } catch (e) {
      return [];
    }
  }, [destination]);

  const filteredCities = useMemo(() => {
    let list = [...cities];
    
    let recents: string[] = [];
    try {
      const stored = localStorage.getItem('recent_destinations');
      if (stored) {
        recents = JSON.parse(stored);
      }
    } catch (e) {
      console.warn("Falha ao obter destinos recentes do localStorage:", e);
    }

    if (citySearch) {
      const term = normalizeText(citySearch);
      list = list.filter(city => normalizeText(city).includes(term));
      return list.sort((a, b) => a.localeCompare(b));
    }

    const otherCities = list.filter(city => !recents.includes(city)).sort((a, b) => a.localeCompare(b));
    return [...recents, ...otherCities];
  }, [cities, citySearch, destination]);

  const sameSectorPersons = useMemo(() => {
    if (!currentUser || !currentUser.sectorId) return persons; 
    if (currentUser.role === 'admin') return persons.sort((a, b) => a.name.localeCompare(b.name));
    
    return persons
      .filter(p => p.sectorId === currentUser.sectorId)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [persons, currentUser]);

  const filteredPersons = useMemo(() => {
    const term = normalizeText(personSearch);
    if (!term) return sameSectorPersons;
    return sameSectorPersons.filter(p => normalizeText(p.name).includes(term));
  }, [sameSectorPersons, personSearch]);

  const filteredVehicles = useMemo(() => {
    // Filtrar veículos do tipo "acessórios" e "pesados" para não aparecerem na seleção direta
    const allowedVehicles = vehicles.filter(v => {
      const isAcessorio = v.type === 'acessorio' || v.vehicleCategory === 'Acessórios';
      const isPesado = v.type === 'pesado' || v.vehicleCategory === 'Máquina Pesada' || v.vehicleCategory === 'Caminhão';
      return !isAcessorio && !isPesado;
    });

    const term = normalizeText(vehicleSearch);
    if (!term) return allowedVehicles;
    return allowedVehicles.filter(v => 
      normalizeText(`${v.brand} ${v.model} ${v.plate}`).includes(term)
    );
  }, [vehicles, vehicleSearch, departureDateTime, returnDateTime, diariaEvents]);

  const isFormValid = isStep1Valid && reason.trim().length >= 50;

  const handleSubmit = async () => {
    if (returnDateTime && isDateExpired(returnDateTime) && !isGestorOrAdmin) {
      setIsExpiredModalOpen(true);
      return;
    }
    if (!isFormValid || !currentUser) return;
    setIsLoading(true);
    
    const hasReturn = !!returnDateTime.trim() && isGestorOrAdmin;

    const initialStatus = isGestorOrAdmin
      ? (hasReturn ? 'aguardando_gestor' : 'viagem_programada')
      : 'aguardando_aprovacao';

    try {
      // Cria uma viagem individualizada para cada servidor selecionado
      for (const p of selectedPersons) {
        await createDiariaEvento({
          pessoas: [p],
          destino: destination,
          data_saida: departureDateTime,
          // Se o campo RETORNO for preenchido por gestor/admin, salva a data; caso contrário, salva sentinela para o fluxo Viajar
          data_retorno: hasReturn ? returnDateTime : '2099-12-31T00:00:00.000Z',
          motivo: reason.trim(),
          setor_id: currentUser.sectorId,
          user_id: currentUser.id,
          user_name: currentUser.name,
          status: initialStatus,
          hospedagem,
          hospedagem_dias: hospedagem ? hospedagemDias : 0,
          veiculo: selectedVehicle,
          veiculo_outro: selectedVehicle === 'OUTRO' ? customVehicle : '',
          distancia: Number(distancia) || 0
        });
      }
      
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        if (onFinish) {
          onFinish();
        } else {
          window.history.pushState({}, '', '/Diarias');
          window.dispatchEvent(new Event('popstate'));
        }
      }, 2500);
    } catch (error) {
      alert("Erro ao salvar o evento. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const labelClass = "block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2";
  const inputContainerClass = "relative flex items-center w-full bg-slate-50 border border-slate-200 rounded-xl transition-all focus-within:bg-white focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/5";
  const inputClass = "w-full bg-transparent pl-11 pr-4 py-3 text-sm font-medium text-slate-900 outline-none";

  const steps = [
    { id: 1, label: 'Informações', icon: FileText },
    { id: 2, label: 'Descrição', icon: MessageSquare }
  ];
  
  const stepsStatus: Record<number, 'completed' | 'in_progress' | 'empty' | 'current'> = {
    1: currentStep === 1 ? 'current' : isStep1Valid ? 'completed' : 'empty',
    2: currentStep === 2 ? 'current' : reason.trim().length > 0 ? 'completed' : 'empty'
  };

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? '100%' : '-100%',
      opacity: 0
    }),
    center: {
      x: 0,
      opacity: 1,
      transition: {
        x: { type: "spring" as const, stiffness: 300, damping: 30 },
        opacity: { duration: 0.2 }
      }
    },
    exit: (direction: number) => ({
      x: direction < 0 ? '100%' : '-100%',
      opacity: 0,
      transition: {
        x: { type: "spring" as const, stiffness: 300, damping: 30 },
        opacity: { duration: 0.2 }
      }
    })
  };

  const mobileStepsList = useMemo(() => {
    const steps = [
      { key: 'servidor', title: 'Servidor' },
      { key: 'destino', title: 'Destino' },
      { key: 'saida', title: 'Data de Saída' },
    ];
    if (isGestorOrAdmin) {
      steps.push({ key: 'retorno', title: 'Data de Retorno' });
    }
    if (shouldShowHospedagem) {
      steps.push({ key: 'hospedagem', title: 'Hospedagem' });
    }
    steps.push(
      { key: 'veiculo', title: 'Veículo' },
      { key: 'motivo', title: 'Motivo' },
      { key: 'revisao', title: 'Revisão' }
    );
    return steps;
  }, [isGestorOrAdmin, shouldShowHospedagem]);

  const isMobileStepValid = (step: number) => {
    const stepObj = mobileStepsList[step - 1];
    if (!stepObj) return false;
    switch (stepObj.key) {
      case 'servidor':
        return selectedPersons.length > 0 && selectedPersons.every(p => p && p.id && p.name);
      case 'destino':
        return destination !== '' && !isCalculatingDistance;
      case 'saida':
        return departureDateTime !== '';
      case 'retorno':
        return !returnDateTime || !isDateExpired(returnDateTime) || isGestorOrAdmin;
      case 'hospedagem':
        return !hospedagem || (hospedagem && hospedagemDias > 0);
      case 'veiculo':
        return selectedVehicle !== '' && (selectedVehicle !== 'OUTRO' || customVehicle.trim() !== '');
      case 'motivo':
        return reason.trim().length >= 50;
      case 'revisao':
        return isFormValid;
      default:
        return false;
    }
  };

  if (isMobile) {
    const totalMobileSteps = mobileStepsList.length;
    const currentMobileStepObj = mobileStepsList[mobileStep - 1] || mobileStepsList[0];
    const canChangePerson = canAddExtraServer;
    const selectedPersonData = selectedPersons[0] ? persons.find(p => p.id === selectedPersons[0].id) : null;
    const selectedPersonJob = selectedPersonData 
      ? (jobs.find(j => j.id === selectedPersonData.jobId)?.name || 'Sem Cargo')
      : 'Sem Cargo';

    const handleMobileNext = () => {
      if (isMobileStepValid(mobileStep)) {
        if (mobileStep < totalMobileSteps) {
          setDirection(1);
          setMobileStep(prev => prev + 1);
        } else {
          handleSubmit();
        }
      }
    };

    const handleMobileBack = () => {
      if (mobileStep > 1) {
        setDirection(-1);
        setMobileStep(prev => prev - 1);
      } else {
        onBack();
      }
    };

    return (
      <div className="flex flex-col h-full bg-slate-100 w-full relative overflow-hidden">
        
        {/* Barra de progresso e Cabeçalho Mobile */}
        <div className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm shrink-0">
          {/* Barra de progresso superior */}
          <div className="w-full h-1.5 bg-slate-100 relative">
            <div 
              className="h-full bg-indigo-600 transition-all duration-300 ease-out" 
              style={{ width: `${(mobileStep / totalMobileSteps) * 100}%` }}
            />
          </div>
          
          <div className="px-4 py-3 flex items-center justify-between">
            <button 
              onClick={handleMobileBack}
              disabled={isLoading}
              className="p-2 -ml-2 text-slate-500 hover:text-slate-900 active:scale-95 transition-all"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            
            <div className="text-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Passo {mobileStep} de {totalMobileSteps}</span>
              <h2 className="text-xs font-bold text-slate-800">
                {currentMobileStepObj.title}
              </h2>
            </div>
            
            <div className="w-10" /> {/* Espaçador para equilibrar o layout */}
          </div>
        </div>

        {/* Área central com animações */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-start min-h-0">
          <div className="w-full max-w-sm flex-1 flex flex-col justify-start items-center pt-2 pb-4 relative min-h-[350px]">
            <AnimatePresence initial={false} custom={direction} mode="wait">
              <motion.div
                key={mobileStep}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className={`w-full max-w-sm bg-white border border-slate-200/80 rounded-3xl shadow-xl flex flex-col items-center justify-start text-center absolute top-0 ${
                  currentMobileStepObj.key === 'revisao' ? 'p-4 space-y-3' : 'p-6 space-y-5'
                }`}
              >
                
                {/* PASSO: SERVIDOR */}
                {currentMobileStepObj.key === 'servidor' && (
                  <div className="w-full space-y-4">
                    <div className="space-y-2">
                      <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto text-indigo-600 shadow-inner">
                        <Users className="w-7 h-7" />
                      </div>
                      <h3 className="text-xl font-black text-slate-900 tracking-tight">Servidores na Viagem</h3>
                      <p className="text-slate-500 text-xs font-medium max-w-xs mx-auto">
                        Adicione um ou mais servidores para esta viagem.
                      </p>
                    </div>

                    <div className="space-y-3 w-full max-h-[240px] overflow-y-auto pr-1">
                      {selectedPersons.map((pItem, idx) => {
                        const personData = persons.find(p => p.id === pItem.id);
                        const personJob = personData
                          ? (jobs.find(j => j.id === personData.jobId)?.name || 'Sem Cargo')
                          : 'Sem Cargo';

                        return (
                          <div 
                            key={pItem.id || idx}
                            className="p-4 rounded-2xl border border-slate-200 bg-slate-50/90 text-left relative flex flex-col gap-1 shadow-xs"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Servidor {idx + 1}</span>
                              {selectedPersons.length > 1 && canChangePerson && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemovePerson(idx);
                                  }}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                                  title="Remover Servidor"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                            <div 
                              onClick={() => {
                                if (canChangePerson) {
                                  setEditingPersonIndex(idx);
                                  setIsPersonsOpen(true);
                                }
                              }}
                              className={canChangePerson ? 'cursor-pointer' : ''}
                            >
                              <span className="block text-sm font-extrabold text-slate-800 break-words">
                                {pItem.name}
                              </span>
                              <span className="block text-[11px] text-slate-500 font-medium mt-0.5">
                                Cargo: {personJob}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {canChangePerson && (
                      <button
                        type="button"
                        onClick={handleAddPerson}
                        className="w-full py-3 px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-xs uppercase tracking-wider rounded-2xl border border-indigo-200/80 flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xs"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Adicionar outro Servidor</span>
                      </button>
                    )}
                  </div>
                )}

                {/* PASSO: DESTINO */}
                {currentMobileStepObj.key === 'destino' && (
                  <div className="w-full space-y-6">
                    <div className="space-y-2">
                      <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto text-indigo-600 shadow-inner">
                        <MapPin className="w-7 h-7" />
                      </div>
                      <h3 className="text-xl font-black text-slate-900 tracking-tight">Qual o destino da viagem?</h3>
                      <p className="text-slate-500 text-xs font-medium max-w-xs mx-auto">Indique a cidade de destino oficial da viagem.</p>
                    </div>

                    <div 
                      onClick={() => setIsCityOpen(true)}
                      className="w-full p-5 rounded-2xl border text-left bg-slate-50/90 border-slate-200/80 hover:border-indigo-500 hover:ring-4 hover:ring-indigo-500/5 cursor-pointer shadow-sm active:scale-[0.98]"
                    >
                      <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">Cidade de Destino</span>
                      <span className="block text-base font-bold text-slate-800 break-words">
                        {destination || 'Selecionar Cidade de Destino...'}
                      </span>
                      <span className="block text-[10px] text-indigo-600 font-bold mt-3 text-right">Toque para selecionar →</span>
                    </div>

                    {isCalculatingDistance && (
                      <div className="flex items-center justify-center gap-2 text-indigo-600 text-xs font-bold py-1">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Calculando distância da viagem...</span>
                      </div>
                    )}

                    {/* Distância calculada removida da visualização */}
                  </div>
                )}

                {/* PASSO: DATA DE SAÍDA */}
                {currentMobileStepObj.key === 'saida' && (
                  <div className="w-full space-y-6">
                    <div className="space-y-2">
                      <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto text-indigo-600 shadow-inner">
                        <Calendar className="w-7 h-7" />
                      </div>
                      <h3 className="text-xl font-black text-slate-900 tracking-tight">Quando será a saída?</h3>
                      <p className="text-slate-500 text-xs font-medium max-w-xs mx-auto">Defina o dia e horário que iniciará a viagem.</p>
                    </div>

                    <div 
                      onClick={() => setActiveDateModal('departure')}
                      className="w-full p-6 rounded-2xl border text-center bg-slate-50/90 border-slate-200/80 hover:border-indigo-500 hover:ring-4 hover:ring-indigo-500/5 cursor-pointer shadow-sm active:scale-[0.98] space-y-2"
                    >
                      <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Data e Hora de Saída</span>
                      <span className="block text-lg font-black text-slate-800">
                        {departureDateTime ? format(parseISO(departureDateTime), "dd/MM/yyyy") : 'Selecionar Data'}
                      </span>
                      <span className="block text-sm font-semibold text-indigo-600">
                        {departureDateTime ? `às ${format(parseISO(departureDateTime), "HH:mm")}` : 'Toque para abrir calendário'}
                      </span>
                    </div>
                  </div>
                )}

                {/* PASSO: DATA DE RETORNO */}
                {currentMobileStepObj.key === 'retorno' && (
                  <div className="w-full space-y-6">
                    <div className="space-y-2 text-center">
                      <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto text-indigo-600 shadow-inner">
                        <Calendar className="w-7 h-7" />
                      </div>
                      <h3 className="text-xl font-black text-slate-900 tracking-tight">Quando será o retorno? (Opcional)</h3>
                      <p className="text-slate-500 text-xs font-medium max-w-xs mx-auto">
                        Se não preencher a data de retorno, a viagem será ativada para registro em tempo real no card <strong>/Diarias/Viajar</strong>.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <div 
                        onClick={() => setActiveDateModal('return')}
                        className="w-full p-6 rounded-2xl border text-center bg-slate-50/90 border-slate-200/80 hover:border-indigo-500 hover:ring-4 hover:ring-indigo-500/5 cursor-pointer shadow-sm active:scale-[0.98] space-y-2"
                      >
                        <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Data e Hora de Retorno</span>
                        <span className="block text-lg font-black text-slate-800">
                          {returnDateTime ? format(parseISO(returnDateTime), "dd/MM/yyyy") : 'Deixar em Branco (Viajar)'}
                        </span>
                        <span className="block text-sm font-semibold text-indigo-600">
                          {returnDateTime ? `às ${format(parseISO(returnDateTime), "HH:mm")}` : 'Toque para selecionar se desejar'}
                        </span>
                      </div>

                      {returnDateTime && (
                        <button
                          type="button"
                          onClick={() => setReturnDateTime('')}
                          className="w-full py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <X className="w-4 h-4" />
                          <span>Limpar Retorno (Ativar fluxo Viajar)</span>
                        </button>
                      )}
                    </div>

                    {returnDateTime && isDateExpired(returnDateTime) && (
                      <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-left space-y-2">
                        <div className="flex items-center gap-1.5 text-red-700 font-bold text-xs uppercase tracking-wider">
                          <AlertTriangle className="w-4 h-4" />
                          <span>Atenção: Prazo Excedido</span>
                        </div>
                        <p className="text-[11px] font-medium text-red-950 leading-relaxed">
                          A data de retorno selecionada possui mais de 10 dias de atraso. O sistema não permite lançamentos fora do prazo legal (Dec. 64/2017). Selecione outra data.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* PASSO: HOSPEDAGEM */}
                {currentMobileStepObj.key === 'hospedagem' && (
                  <div className="w-full space-y-6">
                    <div className="space-y-2">
                      <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto text-indigo-600 shadow-inner">
                        <Bed className="w-7 h-7" />
                      </div>
                      <h3 className="text-xl font-black text-slate-900 tracking-tight">Haverá hospedagem?</h3>
                      <p className="text-slate-500 text-xs font-medium max-w-xs mx-auto">Você precisará pernoitar em hotel ou alojamento no destino?</p>
                    </div>

                    <div className="flex gap-4 w-full">
                      <button
                        type="button"
                        onClick={() => {
                          setHospedagem(true);
                          setHospedagemDias(1);
                        }}
                        className={`flex-1 py-4 text-sm font-bold rounded-2xl border transition-all active:scale-98 ${
                          hospedagem 
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-600/15 scale-[1.02]' 
                            : 'bg-slate-50/95 text-slate-700 border-slate-200/80 hover:bg-slate-100/60'
                        }`}
                      >
                        SIM
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setHospedagem(false);
                          setHospedagemDias(0);
                        }}
                        className={`flex-1 py-4 text-sm font-bold rounded-2xl border transition-all active:scale-98 ${
                          !hospedagem 
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-600/15 scale-[1.02]' 
                            : 'bg-slate-50/95 text-slate-700 border-slate-200/80 hover:bg-slate-100/60'
                        }`}
                      >
                        NÃO
                      </button>
                    </div>

                    <AnimatePresence>
                      {hospedagem && (
                        <motion.div
                          initial={{ opacity: 0, height: 0, y: -10 }}
                          animate={{ opacity: 1, height: 'auto', y: 0 }}
                          exit={{ opacity: 0, height: 0, y: -10 }}
                          className="w-full bg-slate-100 rounded-2xl p-4 border border-slate-200/60 flex flex-col items-center space-y-3 overflow-hidden shadow-inner"
                        >
                          <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Quantas noites de hospedagem?</label>
                          <div className="flex items-center gap-6">
                            <button
                              type="button"
                              onClick={() => setHospedagemDias(prev => Math.max(1, prev - 1))}
                              className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-600 hover:text-slate-900 border border-slate-200 active:scale-90 transition-all shadow-sm"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="text-3xl font-black text-slate-800 min-w-[40px] text-center">{hospedagemDias}</span>
                            <button
                              type="button"
                              onClick={() => setHospedagemDias(prev => prev + 1)}
                              className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-600 hover:text-slate-900 border border-slate-200 active:scale-90 transition-all shadow-sm"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                          <span className="text-[10px] font-bold text-slate-400">Total de diárias a serem calculadas</span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* PASSO: VEÍCULO */}
                {currentMobileStepObj.key === 'veiculo' && (
                  <div className="w-full space-y-6">
                    <div className="space-y-2">
                      <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto text-indigo-600 shadow-inner">
                        <Car className="w-7 h-7" />
                      </div>
                      <h3 className="text-xl font-black text-slate-900 tracking-tight">Qual será o veículo?</h3>
                      <p className="text-slate-500 text-xs font-medium max-w-xs mx-auto">Selecione o meio de transporte oficial para a viagem.</p>
                    </div>

                    <div 
                      onClick={() => setIsVehiclesOpen(true)}
                      className="w-full p-5 rounded-2xl border text-left bg-slate-50/90 border-slate-200/80 hover:border-indigo-500 hover:ring-4 hover:ring-indigo-500/5 cursor-pointer shadow-sm active:scale-[0.98]"
                    >
                      <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">Veículo Selecionado</span>
                      <span className="block text-base font-bold text-slate-800 break-words">
                        {selectedVehicle === 'OUTRO' 
                          ? 'OUTROS (Especificar...)' 
                          : (selectedVehicle || 'Selecionar Veículo...')}
                      </span>
                      <span className="block text-[10px] text-indigo-600 font-bold mt-3 text-right">Toque para selecionar →</span>
                    </div>

                    <AnimatePresence>
                      {selectedVehicle === 'OUTRO' && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="w-full text-left space-y-2 overflow-hidden"
                        >
                          <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Detalhes do Veículo (Pesados / Outros)</label>
                          <div className="relative flex items-center w-full bg-slate-50/90 border border-slate-200/80 rounded-xl px-4 py-3 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/5 transition-all shadow-sm">
                            <Car className="w-4 h-4 text-slate-400 shrink-0 mr-3" />
                            <input
                              type="text"
                              value={customVehicle}
                              onChange={(e) => setCustomVehicle(e.target.value)}
                              placeholder="Digite a marca, modelo e placa..."
                              className="w-full bg-transparent text-base font-medium text-slate-900 outline-none"
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* PASSO: MOTIVO DA VIAGEM */}
                {currentMobileStepObj.key === 'motivo' && (
                  <div className="w-full space-y-6">
                    <div className="space-y-2">
                      <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto text-indigo-600 shadow-inner">
                        <FileText className="w-7 h-7" />
                      </div>
                      <h3 className="text-xl font-black text-slate-900 tracking-tight">Qual o motivo da viagem?</h3>
                      <p className="text-slate-500 text-xs font-medium max-w-xs mx-auto">Forneça justificativa pública detalhada (mínimo de 50 caracteres).</p>
                    </div>

                    <div className="w-full text-left space-y-2">
                      <div className="flex items-center justify-between gap-2 bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/80">
                        <button
                          type="button"
                          onClick={handleToggleMic}
                          disabled={isPolishingAI}
                          className={`flex-1 py-2.5 px-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-xs ${
                            isRecording 
                              ? 'bg-rose-600 text-white animate-pulse shadow-rose-600/30' 
                              : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                          }`}
                        >
                          {isRecording ? (
                            <>
                              <MicOff className="w-4 h-4 text-white" />
                              <span>Parar & Lapidar IA</span>
                            </>
                          ) : (
                            <>
                              <Mic className="w-4 h-4 text-indigo-600" />
                              <span>Falar Motivo por Voz</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={handleManualPolishing}
                          disabled={isRecording || isPolishingAI || !reason.trim()}
                          className="py-2.5 px-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-40 flex items-center justify-center gap-1.5 shadow-xs shrink-0"
                          title="Formatar texto com IA Gemini"
                        >
                          <Sparkles className="w-4 h-4 text-amber-300" />
                          <span>Lapidar IA</span>
                        </button>

                        {reason.trim().length > 0 && (
                          <button
                            type="button"
                            onClick={() => setReason('')}
                            disabled={isRecording || isPolishingAI}
                            className="py-2.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-40 flex items-center justify-center gap-1.5 shadow-xs shrink-0 active:scale-95"
                            title="Apagar todo o texto inserido de uma vez"
                          >
                            <Trash2 className="w-4 h-4 text-rose-600" />
                            <span>Apagar</span>
                          </button>
                        )}
                      </div>

                      {isRecording && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center justify-center gap-2 animate-fade-in">
                          <span className="w-2.5 h-2.5 bg-rose-600 rounded-full animate-ping"></span>
                          <span>Ouvindo sua voz... Fale o motivo e toque para finalizar.</span>
                        </div>
                      )}

                      {isPolishingAI && (
                        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-700 text-xs font-bold flex items-center justify-center gap-2 animate-fade-in">
                          <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                          <span>Inteligência Artificial Gemini lapidando a justificativa...</span>
                        </div>
                      )}

                      <div className="relative flex items-start w-full bg-slate-50/90 border border-slate-200/80 rounded-2xl p-4 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/5 transition-all shadow-sm">
                        <MessageSquare className="w-4 h-4 text-slate-400 shrink-0 mr-3 mt-1" />
                        <textarea
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="Descreva a agenda do evento ou clique em Falar Motivo por Voz acima..."
                          className="w-full min-h-[260px] bg-transparent text-base font-medium text-slate-900 outline-none resize-none overflow-y-auto leading-relaxed"
                        />
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-bold px-1 mt-1">
                        <span className={reason.trim().length >= 50 ? "text-emerald-600" : "text-amber-600"}>
                          {reason.trim().length >= 50 ? "Requisito mínimo atingido!" : `Faltam ${50 - reason.trim().length} caracteres`}
                        </span>
                        <span className="text-slate-400 font-mono">
                          {reason.trim().length} / 50
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* PASSO: REVISÃO */}
                {currentMobileStepObj.key === 'revisao' && (
                  <div className="w-full space-y-4">
                    <div className="space-y-1">
                      <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto text-emerald-600 shadow-inner mb-1">
                        <CheckCircle2 className="w-6 h-6" />
                      </div>
                      <h3 className="text-xl font-black text-slate-900 tracking-tight">Revisar Solicitação</h3>
                      <p className="text-slate-500 text-[11px] font-medium max-w-xs mx-auto">Confirme todos os dados antes de registrar o lançamento final.</p>
                    </div>

                    {/* Cartão de Resumo */}
                    <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl shadow-sm text-left overflow-hidden divide-y divide-slate-100">
                      
                      <div className="py-2 px-3">
                        <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-0.5">Servidores ({selectedPersons.length})</span>
                        <p className="text-sm font-bold text-slate-800">{selectedPersons.map(p => p.name).join(', ')}</p>
                      </div>

                      <div className="py-2 px-3">
                        <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-0.5">Destino</span>
                        <p className="text-sm font-bold text-slate-800 break-words">{destination}</p>
                      </div>

                      <div className="py-2 px-3 flex justify-between gap-4">
                        <div className="flex-1">
                          <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-0.5">Saída</span>
                          <p className="text-xs font-bold text-slate-800">
                            {departureDateTime ? format(parseISO(departureDateTime), "dd/MM/yyyy 'às' HH:mm") : '-'}
                          </p>
                        </div>
                        <div className="flex-1">
                          <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-0.5">Retorno</span>
                          <p className="text-xs font-bold text-slate-800">
                            {returnDateTime ? format(parseISO(returnDateTime), "dd/MM/yyyy 'às' HH:mm") : 'A definir em /Diarias/Viajar'}
                          </p>
                        </div>
                      </div>
                      {!returnDateTime && (
                        <div className="py-2 px-3 bg-emerald-50 border-t border-emerald-100">
                          <p className="text-[10px] font-semibold text-emerald-700 leading-relaxed">
                            ⏱ Viagem em tempo real: o retorno será registrado ao finalizar em <strong>Diarias/Viajar</strong>
                          </p>
                        </div>
                      )}

                      {shouldShowHospedagem && (
                        <div className="py-2 px-3 flex justify-between items-center gap-4">
                          <div>
                            <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-0.5">Hospedagem</span>
                            <p className="text-sm font-bold text-slate-800">
                              {hospedagem ? `Sim (${hospedagemDias} noites)` : 'Não'}
                            </p>
                          </div>
                          <div>
                            <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-0.5">Veículo</span>
                            <p className="text-sm font-bold text-slate-800 break-words">
                              {selectedVehicle === 'OUTRO' ? customVehicle : selectedVehicle}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="py-2 px-3 flex justify-between items-center gap-4">
                        <div className="flex-1 min-w-0">
                          <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-0.5">Motivo</span>
                          <p className="text-xs text-slate-600 font-semibold truncate">
                            {reason}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsReasonMaximized(true)}
                          className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-black uppercase tracking-wider rounded-lg shrink-0 transition-all border border-indigo-100/50"
                        >
                          Maximizar
                        </button>
                      </div>

                    </div>
                  </div>
                )}
                
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Botões de Ação Inferiores do Mobile */}
        <div className="p-3.5 px-4 border-t border-slate-200/80 flex items-center gap-3 w-full bg-white shrink-0 shadow-lg z-30 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={handleMobileBack}
            disabled={isLoading}
            className="flex items-center justify-center gap-1.5 py-3 px-5 bg-white border border-slate-200 text-slate-700 font-bold uppercase tracking-widest text-[10px] rounded-xl active:bg-slate-50 disabled:opacity-50 transition-all shadow-sm shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Voltar</span>
          </button>

          {mobileStep < totalMobileSteps ? (
            <button
              type="button"
              onClick={handleMobileNext}
              disabled={!isMobileStepValid(mobileStep) || isLoading}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 px-6 bg-slate-900 text-white font-bold uppercase tracking-widest text-[10px] rounded-xl active:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-md shadow-slate-950/15"
            >
              <span>Avançar</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!isFormValid || isLoading || isSuccess}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 px-6 bg-emerald-600 text-white font-bold uppercase tracking-widest text-[10px] rounded-xl active:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-600/20"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>{isLoading ? 'Enviando...' : 'Finalizar'}</span>
            </button>
          )}
        </div>

        {/* Modais reaproveitados */}
        {isPersonsOpen && (
          <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 pt-12 sm:p-6 animate-fade-in" onClick={() => { setIsPersonsOpen(false); setEditingPersonIndex(null); }}>
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col h-[70vh] sm:h-auto sm:max-h-[85vh] overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h3 className="font-bold text-slate-900">
                  {editingPersonIndex !== null ? `Alterar Servidor ${editingPersonIndex + 1}` : 'Adicionar Servidor na Viagem'}
                </h3>
                <button onClick={() => { setIsPersonsOpen(false); setEditingPersonIndex(null); }} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 border-b border-slate-100 relative">
                <Search className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={personSearch}
                  onChange={(e) => setPersonSearch(e.target.value)}
                  placeholder="Buscar por nome..."
                  autoFocus={!isMobile}
                  className="w-full bg-slate-50 border border-slate-200 pl-10 pr-4 py-3 rounded-xl text-base font-medium text-slate-900 outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
                />
              </div>
              <div className="flex-1 overflow-y-auto p-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                <div className="hide-scroll space-y-1">
                  {filteredPersons.length > 0 ? (
                    filteredPersons.map((person) => {
                      const isAlreadyAdded = selectedPersons.some(p => p.id === person.id);
                      const isCurrentEditing = editingPersonIndex !== null && selectedPersons[editingPersonIndex]?.id === person.id;
                      const isSelected = isAlreadyAdded;
                      return (
                        <button
                          key={person.id}
                          onClick={() => {
                            handleSelectPerson({ id: person.id, name: person.name });
                          }}
                          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left text-sm font-medium transition-all group ${isCurrentEditing || isSelected ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'}`}
                        >
                          <div className="flex flex-col">
                            <span className={`${isSelected ? 'font-bold' : ''}`}>{person.name}</span>
                            <span className={`text-[10px] font-normal ${isSelected ? 'text-indigo-500' : 'text-slate-400'}`}>
                              {jobs.find(j => j.id === person.jobId)?.name || 'Sem Cargo'}
                            </span>
                          </div>
                          {isSelected && <Check className="w-5 h-5 text-indigo-600" />}
                        </button>
                      );
                    })
                  ) : (
                    <div className="p-10 text-center flex flex-col items-center">
                      <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                        <Users className="w-6 h-6 text-slate-300" />
                      </div>
                      <p className="text-sm text-slate-500 font-medium">Nenhuma pessoa encontrada.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {isCityOpen && (
          <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 pt-12 sm:p-6 animate-fade-in" onClick={() => setIsCityOpen(false)}>
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col h-[70vh] sm:h-auto sm:max-h-[85vh] overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h3 className="font-bold text-slate-900">Selecionar Destino</h3>
                <button onClick={() => setIsCityOpen(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 border-b border-slate-100 relative">
                <Search className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={citySearch}
                  onChange={(e) => setCitySearch(e.target.value)}
                  placeholder="Buscar cidade..."
                  autoFocus={!isMobile}
                  className="w-full bg-slate-50 border border-slate-200 pl-10 pr-4 py-3 rounded-xl text-base font-medium text-slate-900 outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
                />
              </div>
              <div className="flex-1 overflow-y-auto p-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                <div className="hide-scroll space-y-1">
                  {filteredCities.length > 0 ? (
                    filteredCities.map((city, idx) => {
                      const isSelected = destination === city;
                      return (
                        <button
                          key={idx}
                          onClick={() => {
                            setDestination(city);
                            saveRecentDestination(city);
                            setIsCityOpen(false);
                            setCitySearch('');
                          }}
                          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left text-sm font-medium transition-all group ${isSelected ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'}`}
                        >
                          <div className="flex items-center gap-2 text-left">
                            {recentDestinationsList.includes(city) && <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />}
                            <span className={`${isSelected ? 'font-bold' : ''} break-words`}>{city}</span>
                          </div>
                          {isSelected && <Check className="w-5 h-5 text-indigo-600" />}
                        </button>
                      );
                    })
                  ) : (
                    <div className="p-10 text-center flex flex-col items-center">
                      <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                        <MapPin className="w-6 h-6 text-slate-300" />
                      </div>
                      <p className="text-sm text-slate-500 font-medium">Nenhuma cidade encontrada.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {isVehiclesOpen && (
          <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 pt-12 sm:p-6 animate-fade-in" onClick={() => setIsVehiclesOpen(false)}>
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col h-[70vh] sm:h-auto sm:max-h-[85vh] overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h3 className="font-bold text-slate-900">Selecionar Veículo</h3>
                <button onClick={() => setIsVehiclesOpen(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4 border-b border-slate-100 relative">
                <Search className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={vehicleSearch}
                  onChange={(e) => setVehicleSearch(e.target.value)}
                  placeholder="Buscar veículo por marca, modelo ou placa..."
                  autoFocus={!isMobile}
                  className="w-full bg-slate-50 border border-slate-200 pl-10 pr-4 py-3 rounded-xl text-base font-medium text-slate-900 outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
                />
              </div>
              <div className="flex-1 overflow-y-auto p-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                <div className="hide-scroll space-y-1">
                  {(() => {
                    const isSelected = selectedVehicle === 'OUTRO';
                    return (
                      <button
                        onClick={() => {
                          setSelectedVehicle('OUTRO');
                          setIsVehiclesOpen(false);
                          setVehicleSearch('');
                        }}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left text-sm font-medium transition-all group ${isSelected ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'}`}
                      >
                        <div className="flex flex-col">
                          <span className={`${isSelected ? 'font-bold' : ''}`}>OUTROS</span>
                          <span className={`text-[10px] font-normal ${isSelected ? 'text-indigo-500' : 'text-slate-400'}`}>
                            Especificar veículo personalizado (pesados, etc.)
                          </span>
                        </div>
                        {isSelected && <Check className="w-5 h-5 text-indigo-600" />}
                      </button>
                    );
                  })()}

                  {filteredVehicles.length > 0 ? (
                    filteredVehicles.map((v) => {
                      const statusInfo = getVehicleStatusInfo(v);
                      const vehicleValue = `${v.brand} ${v.model} - ${v.plate}`;
                      const isSelected = selectedVehicle === vehicleValue;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => {
                            if (!statusInfo.isAvailable) {
                              setVehicleStatusModal({
                                vehicleName: `${v.brand} ${v.model}`,
                                plate: v.plate,
                                statusKey: statusInfo.statusKey as any,
                                statusLabel: statusInfo.statusLabel,
                                badgeClass: statusInfo.badgeClass,
                                evento: statusInfo.evento
                              });
                              return;
                            }
                            setSelectedVehicle(vehicleValue);
                            setCustomVehicle('');
                            setIsVehiclesOpen(false);
                            setVehicleSearch('');
                          }}
                          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left text-sm font-medium transition-all group ${
                            !statusInfo.isAvailable 
                              ? 'bg-slate-50/60 opacity-90 cursor-pointer hover:bg-slate-100/80 border border-slate-200/60' 
                              : isSelected 
                                ? 'bg-indigo-50 text-indigo-700' 
                                : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="flex flex-col pr-2">
                            <div className="flex items-center gap-2">
                              <span className={`${isSelected ? 'font-bold' : 'font-semibold text-slate-800'}`}>{v.brand} {v.model}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${statusInfo.badgeClass}`}>
                                {statusInfo.statusLabel}
                              </span>
                            </div>
                            <span className={`text-[10px] font-normal ${isSelected ? 'text-indigo-500' : 'text-slate-400'}`}>
                              Placa: {v.plate} | Cor: {v.color} | Setor: {sectors.find(s => s.id === (v.sector_id || v.sectorId))?.name || 'Sem Setor'}
                            </span>
                          </div>
                          {isSelected && <Check className="w-5 h-5 text-indigo-600 shrink-0" />}
                          {!statusInfo.isAvailable && <Info className="w-4 h-4 text-slate-400 shrink-0" />}
                        </button>
                      );
                    })
                  ) : (
                    vehicleSearch && (
                      <div className="p-10 text-center flex flex-col items-center">
                        <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                          <Car className="w-6 h-6 text-slate-300" />
                        </div>
                        <p className="text-sm text-slate-500 font-medium">Nenhum veículo encontrado.</p>
                      </div>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <DateTimePickerModal
          isOpen={activeDateModal === 'departure'}
          onClose={() => setActiveDateModal(null)}
          onSelect={handleDepartureSelect}
          initialValue={departureDateTime}
          title="Data e Hora de Saída"
          isAdmin={currentUser?.role === 'admin'}
        />
        
        <DateTimePickerModal
          isOpen={activeDateModal === 'return'}
          onClose={() => setActiveDateModal(null)}
          onSelect={handleReturnSelect}
          initialValue={returnDateTime}
          title="Data e Hora de Retorno"
          isAdmin={currentUser?.role === 'admin'}
        />

        {isExpiredModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setIsExpiredModalOpen(false)}>
            <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 animate-slide-up" onClick={e => e.stopPropagation()}>
              <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-6 text-white text-center relative flex flex-col items-center">
                <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-3 border border-white/30 shadow-inner">
                  <AlertTriangle className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-lg font-black tracking-tight uppercase">Data da Diária Expirada</h3>
                <p className="text-xs text-amber-100 font-semibold mt-1">Prazo Limite Excedido</p>
                <button 
                  onClick={() => setIsExpiredModalOpen(false)} 
                  className="absolute top-4 right-4 p-2 text-white/80 hover:text-white bg-black/10 hover:bg-black/20 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-5 text-center">
                <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 text-amber-950 space-y-3 text-left">
                  <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">Fundamentação Legal</span>
                    <span className="text-[10px] font-bold text-amber-800 bg-amber-200/60 px-2 py-0.5 rounded">Lei 1084/2017 • Decreto 64/2017</span>
                  </div>
                  <p className="text-xs font-semibold leading-relaxed text-amber-900 italic">
                    “Art. 38 - O prazo da prestação de contas de diárias, e das despesas relacionadas com a viagem, inclusive passagens aéreas, é de dez dias, contados da data de retorno do servidor e/ou agente político à Sede do Município.”
                  </p>
                </div>

                <button
                  onClick={() => setIsExpiredModalOpen(false)}
                  className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl shadow-lg active:scale-[0.98] transition-all"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        )}

        {isSuccess && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 animate-slide-up text-center">
              <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-8 text-white flex flex-col items-center">
                <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-4 border border-white/30 shadow-inner animate-bounce">
                  <CheckCircle2 className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-xl font-black tracking-tight uppercase">Solicitação Finalizada!</h3>
                <p className="text-xs text-emerald-100 font-semibold mt-2">Sua viagem foi registrada com sucesso.</p>
              </div>
              <div className="p-6">
                <p className="text-sm font-semibold text-slate-500 mb-2">Redirecionando você para o Módulo de Diárias...</p>
                <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mt-4"></div>
              </div>
            </div>
          </div>
        )}

        {/* Modal - Erro de Validação de Data (Regra de Negócio) Mobile */}
        {dateValidationError && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setDateValidationError(null)}>
            <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 animate-slide-up" onClick={e => e.stopPropagation()}>
              <div className="bg-gradient-to-br from-red-500 to-rose-600 p-6 text-white text-center relative flex flex-col items-center">
                <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-3 border border-white/30 shadow-inner">
                  <AlertTriangle className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-lg font-black tracking-tight uppercase">{dateValidationError.title}</h3>
                <p className="text-xs text-red-100 font-semibold mt-1">Ação Não Permitida</p>
                <button 
                  onClick={() => setDateValidationError(null)} 
                  className="absolute top-4 right-4 p-2 text-white/80 hover:text-white bg-black/10 hover:bg-black/20 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-5 text-center">
                <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-red-950 space-y-2 text-left">
                  <p className="text-xs font-bold leading-relaxed text-red-900">
                    {dateValidationError.message}
                  </p>
                  {dateValidationError.law && (
                    <p className="text-[10px] font-semibold text-slate-500 leading-normal border-t border-red-200/50 pt-2 mt-2">
                      {dateValidationError.law}
                    </p>
                  )}
                </div>

                <button
                  onClick={() => setDateValidationError(null)}
                  className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl shadow-lg active:scale-[0.98] transition-all"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal - Motivo Maximizado Mobile */}
        {isReasonMaximized && (
          <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setIsReasonMaximized(false)}>
            <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 animate-slide-up flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-black text-slate-800 uppercase tracking-wider">Motivo da Viagem</span>
                </div>
                <button onClick={() => setIsReasonMaximized(false)} className="p-1 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="p-5 max-h-[300px] overflow-y-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                <style>{`.hide-scroll::-webkit-scrollbar { display: none; }`}</style>
                <p className="text-sm font-semibold text-slate-700 leading-relaxed break-words whitespace-pre-line hide-scroll">
                  {reason}
                </p>
              </div>
              <div className="p-4 bg-slate-50 border-t border-slate-100">
                <button
                  onClick={() => setIsReasonMaximized(false)}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-[10px] uppercase tracking-widest rounded-xl transition-all"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 w-full relative">
      
      {/* NEW HEADER LAYOUT: Back Button | Stepper | Action Button */}
      <div className="sticky top-0 z-40 bg-white border-b border-slate-200 px-3 sm:px-6 py-1 flex items-center justify-between gap-2 sm:gap-6 shadow-sm min-h-[50px]">
          {/* 1. Voltar (Padrão) */}
          <button onClick={onBack} disabled={isLoading} className={`flex items-center gap-1 sm:gap-2 group px-2 sm:px-3 py-2 transition-all font-black uppercase tracking-tighter text-[10px] sm:text-[11px] ${isLoading ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-slate-900'}`} title="Voltar para Diárias">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span className="hidden xs:inline">Voltar</span>
          </button>

          {/* 2. Stepper */}
          <div className="flex-1 flex justify-center max-w-[200px] xs:max-w-xs sm:max-w-lg">
              <div className="w-full py-2 sm:py-4">
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
                          } else if (status === 'current') {
                              circleClass = 'bg-blue-600 border-blue-600 text-white ring-4 ring-blue-100';
                              labelClass = 'text-blue-600 font-bold';
                          }

                          return (
                              <React.Fragment key={step.id}>
                                  <div
                                      onClick={() => {
                                          if (step.id === 1) setCurrentStep(1);
                                          if (step.id === 2 && isStep1Valid) setCurrentStep(2);
                                      }}
                                      className={`flex flex-col items-center gap-1 sm:gap-2 relative z-10 cursor-pointer group px-1 sm:px-2 bg-white rounded-xl transition-all duration-300 ${status === 'current' ? 'scale-105' : 'hover:scale-102'}`}
                                  >
                                      <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center transition-all shadow-sm ${circleClass}`}>
                                          <Icon className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                                      </div>
                                      <span className={`text-[9px] sm:text-[10px] uppercase tracking-wider transition-colors bg-white ${labelClass}`}>
                                          {step.label}
                                      </span>
                                  </div>

                                  {!isLast && (
                                      <div className="flex-1 h-1 mx-1 sm:mx-2 rounded-full overflow-hidden bg-slate-100 relative -z-10">
                                          <div
                                              className={`h-full transition-all duration-500 ${status === 'completed' || currentStep > step.id ? 'bg-emerald-500' : 'bg-transparent'}`}
                                          />
                                      </div>
                                  )}
                              </React.Fragment>
                          );
                      })}
                  </div>
              </div>
          </div>

          {/* 3. Botão de Ação (Avançar/Finalizar) */}
          <div className="min-w-0 sm:min-w-[140px] flex justify-end shrink-0">
              {currentStep === 1 ? (
                  <button
                      onClick={() => {
                        if (returnDateTime && isDateExpired(returnDateTime) && !isGestorOrAdmin) {
                          setIsExpiredModalOpen(true);
                          return;
                        }
                        setCurrentStep(2);
                      }}
                      disabled={!isStep1Valid || isLoading}
                      className="flex items-center gap-1 sm:gap-2 px-3 sm:px-6 py-2 sm:py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 shadow-lg shadow-slate-900/20 active:scale-95 transition-all text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                      <span>Avançar</span>
                      <ChevronRight className="w-4 h-4" />
                  </button>
              ) : (
                  <button
                      onClick={handleSubmit}
                      disabled={!isFormValid || isLoading || isSuccess}
                      className="flex items-center gap-1 sm:gap-2 px-3 sm:px-6 py-2 sm:py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 active:scale-95 transition-all text-xs sm:text-sm animate-pulse disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      <span>{isLoading ? 'Salvando...' : 'Finalizar'}</span>
                  </button>
              )}
          </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 bg-slate-50">
        <div className="w-full max-w-4xl mx-auto space-y-6">
          
          <div className="space-y-3 mb-6">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Registrar Nova Viagem</h1>
            <p className="text-slate-500 font-medium text-sm">Preencha os detalhes abaixo para solicitar a autorização do evento e viagem oficial.</p>
          </div>

          <div className="w-full bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            
            
            {currentStep === 1 && (
              <div className="space-y-6 animate-fade-in">
                
                {/* Pessoas */}
                {(() => {
                  const canChangePerson = canAddExtraServer;

                  return (
                    <div className="space-y-4 border-b border-slate-150 pb-6">
                      <div className="flex items-center justify-between">
                        <label className={labelClass}>Servidores na Viagem</label>
                        <span className="text-[10px] font-bold text-slate-400">
                          {selectedPersons.length} {selectedPersons.length === 1 ? 'servidor' : 'servidores'}
                        </span>
                      </div>

                      <div className="space-y-3">
                        {selectedPersons.map((pItem, idx) => {
                          const personData = persons.find(p => p.id === pItem.id);
                          const personJob = personData
                            ? (jobs.find(j => j.id === personData.jobId)?.name || 'Sem Cargo')
                            : 'Sem Cargo';

                          return (
                            <div key={pItem.id || idx} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/80 space-y-3 relative group hover:border-indigo-200 transition-all">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                                  Servidor {idx + 1}
                                </span>
                                {selectedPersons.length > 1 && canChangePerson && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemovePerson(idx)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                    title="Remover servidor da viagem"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Campo Servidor */}
                                <div className="space-y-1.5">
                                  <label className="text-[9px] font-bold text-slate-400 uppercase">Nome do Servidor</label>
                                  <div
                                    onClick={() => {
                                      if (canChangePerson) {
                                        setEditingPersonIndex(idx);
                                        setIsPersonsOpen(true);
                                      }
                                    }}
                                    className={`${inputContainerClass} ${canChangePerson ? 'cursor-pointer' : 'bg-slate-100/80 border-slate-200 cursor-not-allowed'}`}
                                  >
                                    <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                    <span className={`w-full bg-transparent pl-11 pr-10 py-3 text-sm font-medium outline-none truncate ${pItem.name ? 'text-slate-900 font-bold' : 'text-slate-400'}`}>
                                      {pItem.name || 'Clique para selecionar servidor...'}
                                    </span>
                                    {canChangePerson && (
                                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                        <ChevronDown className="w-4 h-4 text-slate-400" />
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Campo Cargo */}
                                <div className="space-y-1.5">
                                  <label className="text-[9px] font-bold text-slate-400 uppercase">Cargo</label>
                                  <div className={`${inputContainerClass} bg-slate-100/80 border-slate-200 cursor-not-allowed`}>
                                    <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                                    <input
                                      type="text"
                                      readOnly
                                      value={personJob}
                                      className={`${inputClass} text-slate-500 cursor-not-allowed`}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {canChangePerson && (
                        <button
                          type="button"
                          onClick={handleAddPerson}
                          className="w-full py-3 px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-extrabold text-xs uppercase tracking-wider rounded-2xl border border-indigo-200/80 flex items-center justify-center gap-2 transition-all active:scale-95 shadow-xs"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Adicionar outro Servidor nesta viagem</span>
                        </button>
                      )}
                    </div>
                  );
                })()}

                {/* Destino */}
                <div className="relative space-y-3">
                  <label className={labelClass}>Destino (Cidade / UF)</label>
                  <div
                    onClick={() => setIsCityOpen(true)}
                    className={`${inputContainerClass} cursor-pointer ${isCityOpen ? 'bg-white border-indigo-500 ring-4 ring-indigo-500/5' : ''}`}
                  >
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <span className={`w-full bg-transparent pl-11 pr-10 py-3 text-sm font-medium outline-none truncate ${destination ? 'text-slate-900' : 'text-slate-500'}`}>
                      {destination || 'Clique para selecionar a cidade de destino...'}
                    </span>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      {isCityLoading ? (
                        <Loader2 className="w-4 h-4 text-indigo-500 animate-spin" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </div>
                  </div>
                  {/* Datas */}
            <div className={`grid grid-cols-1 ${isGestorOrAdmin ? 'md:grid-cols-2' : ''} gap-6`}>
              <div className="space-y-3">
                <label className={labelClass}>Saída</label>
                <div 
                  onClick={() => setActiveDateModal('departure')}
                  className={`${inputContainerClass} cursor-pointer ${activeDateModal === 'departure' ? 'bg-white border-indigo-500 ring-4 ring-indigo-500/5' : ''}`}
                >
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <span className={`w-full bg-transparent pl-11 pr-10 py-3 text-sm font-medium outline-none truncate ${departureDateTime ? 'text-slate-900' : 'text-slate-500'}`}>
                    {departureDateTime ? format(parseISO(departureDateTime), "dd/MM/yyyy 'às' HH:mm") : 'Selecione a data de saída'}
                  </span>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              </div>
              {isGestorOrAdmin && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className={labelClass}>Retorno (Opcional)</label>
                    {returnDateTime && (
                      <button
                        type="button"
                        onClick={() => setReturnDateTime('')}
                        className="text-[10px] font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>Limpar (Ativa Viajar)</span>
                      </button>
                    )}
                  </div>
                  <div 
                    onClick={() => setActiveDateModal('return')}
                    className={`${inputContainerClass} cursor-pointer ${activeDateModal === 'return' ? 'bg-white border-indigo-500 ring-4 ring-indigo-500/5' : ''}`}
                  >
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <span className={`w-full bg-transparent pl-11 pr-10 py-3 text-sm font-medium outline-none truncate ${returnDateTime ? 'text-slate-900' : 'text-slate-400 italic'}`}>
                      {returnDateTime ? format(parseISO(returnDateTime), "dd/MM/yyyy 'às' HH:mm") : 'Deixar em branco para registrar em /Diarias/Viajar'}
                    </span>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

              {/* Hospedagem */}
              {shouldShowHospedagem && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className={labelClass}>Hospedagem</label>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setHospedagem(true);
                          setHospedagemDias(1);
                        }}
                        className={`flex-1 py-3 text-sm font-bold rounded-xl border transition-all ${
                          hospedagem 
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/10' 
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Sim
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setHospedagem(false);
                          setHospedagemDias(0);
                        }}
                        className={`flex-1 py-3 text-sm font-bold rounded-xl border transition-all ${
                          !hospedagem 
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/10' 
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Não
                      </button>
                    </div>
                  </div>

                  {hospedagem && (
                    <div className="space-y-3 animate-fade-in">
                      <label className={labelClass}>Quantas Noites?</label>
                      <div className={inputContainerClass}>
                        <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        <input
                          type="number"
                          min="1"
                          value={hospedagemDias}
                          onChange={(e) => setHospedagemDias(Math.max(1, parseInt(e.target.value) || 1))}
                          className={inputClass}
                          placeholder="Número de noites"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Veículo */}
              <div className="space-y-3">
                <label className={labelClass}>Veículo</label>
                <div 
                  onClick={() => setIsVehiclesOpen(true)}
                  className={`${inputContainerClass} cursor-pointer ${isVehiclesOpen ? 'bg-white border-indigo-500 ring-4 ring-indigo-500/5' : ''}`}
                >
                  <Car className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <span className={`w-full bg-transparent pl-11 pr-10 py-3 text-sm font-medium outline-none truncate ${selectedVehicle ? 'text-slate-900' : 'text-slate-500'}`}>
                    {selectedVehicle === 'OUTRO' 
                      ? 'OUTROS (Especificar...)' 
                      : (selectedVehicle || 'Clique para selecionar o veículo...')}
                  </span>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </div>
                </div>

                {selectedVehicle === 'OUTRO' && (
                  <div className="space-y-2 mt-2 animate-fade-in">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Especificar Veículo (Pesados / Outros)</label>
                    <div className={inputContainerClass}>
                      <Car className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <input
                        type="text"
                        value={customVehicle}
                        onChange={(e) => setCustomVehicle(e.target.value)}
                        placeholder="Digite a marca, modelo e placa do veículo..."
                        className={inputClass}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
            )}

            {currentStep === 2 && (
            <div className="space-y-8 animate-fade-in">
              {/* Motivo */}
              <div className="space-y-3">
                <label className={labelClass}>Motivo da Viagem</label>
                
                <div className="flex items-center justify-between gap-2 bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/80">
                  <button
                    type="button"
                    onClick={handleToggleMic}
                    disabled={isPolishingAI}
                    className={`flex-1 py-2.5 px-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-xs ${
                      isRecording 
                        ? 'bg-rose-600 text-white animate-pulse shadow-rose-600/30' 
                        : 'bg-white text-slate-700 hover:bg-slate-50 border border-slate-200'
                    }`}
                  >
                    {isRecording ? (
                      <>
                        <MicOff className="w-4 h-4 text-white" />
                        <span>Parar & Lapidar IA</span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-4 h-4 text-indigo-600" />
                        <span>Falar Motivo por Voz</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleManualPolishing}
                    disabled={isRecording || isPolishingAI || !reason.trim()}
                    className="py-2.5 px-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-40 flex items-center justify-center gap-1.5 shadow-xs shrink-0"
                    title="Formatar texto com IA Gemini"
                  >
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Lapidar IA</span>
                  </button>

                  {reason.trim().length > 0 && (
                    <button
                      type="button"
                      onClick={() => setReason('')}
                      disabled={isRecording || isPolishingAI}
                      className="py-2.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-40 flex items-center justify-center gap-1.5 shadow-xs shrink-0 active:scale-95"
                      title="Apagar todo o texto inserido de uma vez"
                    >
                      <Trash2 className="w-4 h-4 text-rose-600" />
                      <span>Apagar</span>
                    </button>
                  )}
                </div>

                {isRecording && (
                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center justify-center gap-2 animate-fade-in">
                    <span className="w-2.5 h-2.5 bg-rose-600 rounded-full animate-ping"></span>
                    <span>Ouvindo sua voz... Fale o motivo e clique em Parar.</span>
                  </div>
                )}

                {isPolishingAI && (
                  <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-700 text-xs font-bold flex items-center justify-center gap-2 animate-fade-in">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                    <span>Inteligência Artificial Gemini lapidando a justificativa...</span>
                  </div>
                )}

                <div className={`${inputContainerClass} items-start`}>
                  <FileText className="absolute left-4 top-4 w-4 h-4 text-slate-400 pointer-events-none" />
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Descreva detalhadamente o objetivo da viagem ou clique no botão de voz acima..."
                    className={`${inputClass} min-h-[160px] resize-none leading-relaxed`}
                  />
                </div>
                <div className="flex justify-between items-center text-[10px] font-bold mt-1 px-1">
                  <span className={reason.trim().length >= 50 ? "text-emerald-600" : "text-amber-600"}>
                    {reason.trim().length >= 50 ? "Requisito mínimo de caracteres atingido!" : `Mínimo de 50 caracteres necessário (faltam ${50 - reason.trim().length} caracteres)`}
                  </span>
                  <span className="text-slate-400 font-mono">
                    {reason.trim().length} / 50
                  </span>
                </div>
              </div>
            </div>
            )}

          </div>
        </div>
      </div>

      {/* Modal - Selecionar Pessoa */}
      {isPersonsOpen && (
        <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 pt-12 sm:p-6 animate-fade-in" onClick={() => setIsPersonsOpen(false)}>
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col h-[70vh] sm:h-auto sm:max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900">Selecionar Pessoa</h3>
              <button onClick={() => setIsPersonsOpen(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 border-b border-slate-100 relative">
              <Search className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={personSearch}
                onChange={(e) => setPersonSearch(e.target.value)}
                placeholder="Buscar por nome..."
                autoFocus={!isMobile}
                className="w-full bg-slate-50 border border-slate-200 pl-10 pr-4 py-3 rounded-xl text-base font-medium text-slate-900 outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              <style>{`.hide-scroll::-webkit-scrollbar { display: none; }`}</style>
              <div className="hide-scroll space-y-1">
                {filteredPersons.length > 0 ? (
                  filteredPersons.map((person) => {
                    const isAlreadyAdded = selectedPersons.some(p => p.id === person.id);
                    const isCurrentEditing = editingPersonIndex !== null && selectedPersons[editingPersonIndex]?.id === person.id;
                    const isSelected = isAlreadyAdded;
                    return (
                      <button
                        key={person.id}
                        onClick={() => {
                          handleSelectPerson({ id: person.id, name: person.name });
                        }}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left text-sm font-medium transition-all group ${isCurrentEditing || isSelected ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'}`}
                      >
                        <div className="flex flex-col">
                          <span className={`${isSelected ? 'font-bold' : ''}`}>{person.name}</span>
                          <span className={`text-[10px] font-normal ${isSelected ? 'text-indigo-500' : 'text-slate-400'}`}>
                            {jobs.find(j => j.id === person.jobId)?.name || 'Sem Cargo'}
                          </span>
                        </div>
                        {isSelected && <Check className="w-5 h-5 text-indigo-600" />}
                      </button>
                    );
                  })
                ) : (
                  <div className="p-10 text-center flex flex-col items-center">
                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                      <Users className="w-6 h-6 text-slate-300" />
                    </div>
                    <p className="text-sm text-slate-500 font-medium">Nenhuma pessoa encontrada.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal - Selecionar Destino */}
      {isCityOpen && (
        <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 pt-12 sm:p-6 animate-fade-in" onClick={() => setIsCityOpen(false)}>
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col h-[70vh] sm:h-auto sm:max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900">Selecionar Destino</h3>
              <button onClick={() => setIsCityOpen(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 border-b border-slate-100 relative">
              <Search className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={citySearch}
                onChange={(e) => setCitySearch(e.target.value)}
                placeholder="Buscar cidade..."
                autoFocus={!isMobile}
                className="w-full bg-slate-50 border border-slate-200 pl-10 pr-4 py-3 rounded-xl text-base font-medium text-slate-900 outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              <div className="hide-scroll space-y-1">
                {filteredCities.length > 0 ? (
                  filteredCities.map((city, idx) => {
                    const isSelected = destination === city;
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          setOverrideVehicleConflict(null);
                          setDestination(city);
                          saveRecentDestination(city);
                          setIsCityOpen(false);
                          setCitySearch('');
                        }}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left text-sm font-medium transition-all group ${isSelected ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'}`}
                      >
                        <div className="flex items-center gap-2 text-left">
                          {recentDestinationsList.includes(city) && <Clock className="w-3.5 h-3.5 text-indigo-500 shrink-0" />}
                          <span className={`${isSelected ? 'font-bold' : ''} break-words`}>{city}</span>
                        </div>
                        {isSelected && <Check className="w-5 h-5 text-indigo-600" />}
                      </button>
                    );
                  })
                ) : (
                  <div className="p-10 text-center flex flex-col items-center">
                    <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                      <MapPin className="w-6 h-6 text-slate-300" />
                    </div>
                    <p className="text-sm text-slate-500 font-medium">Nenhuma cidade encontrada.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal - Selecionar Veículo */}
      {isVehiclesOpen && (
        <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 pt-12 sm:p-6 animate-fade-in" onClick={() => setIsVehiclesOpen(false)}>
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col h-[70vh] sm:h-auto sm:max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <h3 className="font-bold text-slate-900">Selecionar Veículo</h3>
              <button onClick={() => setIsVehiclesOpen(false)} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 border-b border-slate-100 relative">
              <Search className="absolute left-7 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={vehicleSearch}
                onChange={(e) => setVehicleSearch(e.target.value)}
                placeholder="Buscar veículo por marca, modelo ou placa..."
                autoFocus={!isMobile}
                className="w-full bg-slate-50 border border-slate-200 pl-10 pr-4 py-3 rounded-xl text-base font-medium text-slate-900 outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              <div className="hide-scroll space-y-1">
                {/* Opção OUTRO */}
                {(() => {
                  const isSelected = selectedVehicle === 'OUTRO';
                  return (
                    <button
                      onClick={() => {
                        setSelectedVehicle('OUTRO');
                        setIsVehiclesOpen(false);
                        setVehicleSearch('');
                      }}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left text-sm font-medium transition-all group ${isSelected ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'}`}
                    >
                      <div className="flex flex-col">
                        <span className={`${isSelected ? 'font-bold' : ''}`}>OUTROS</span>
                        <span className={`text-[10px] font-normal ${isSelected ? 'text-indigo-500' : 'text-slate-400'}`}>
                          Especificar veículo personalizado (pesados, etc.)
                        </span>
                      </div>
                      {isSelected && <Check className="w-5 h-5 text-indigo-600" />}
                    </button>
                  );
                })()}

                {filteredVehicles.length > 0 ? (
                  filteredVehicles.map((v) => {
                    const statusInfo = getVehicleStatusInfo(v);
                    const vehicleValue = `${v.brand} ${v.model} - ${v.plate}`;
                    const isSelected = selectedVehicle === vehicleValue;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          if (!statusInfo.isAvailable) {
                            setVehicleStatusModal({
                              vehicleName: `${v.brand} ${v.model}`,
                              plate: v.plate,
                              statusKey: statusInfo.statusKey as any,
                              statusLabel: statusInfo.statusLabel,
                              badgeClass: statusInfo.badgeClass,
                              evento: statusInfo.evento
                            });
                            return;
                          }
                          setSelectedVehicle(vehicleValue);
                          setCustomVehicle('');
                          setIsVehiclesOpen(false);
                          setVehicleSearch('');
                        }}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left text-sm font-medium transition-all group ${
                          !statusInfo.isAvailable 
                            ? 'bg-slate-50/60 opacity-90 cursor-pointer hover:bg-slate-100/80 border border-slate-200/60' 
                            : isSelected 
                              ? 'bg-indigo-50 text-indigo-700' 
                              : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex flex-col pr-2">
                          <div className="flex items-center gap-2">
                            <span className={`${isSelected ? 'font-bold' : 'font-semibold text-slate-800'}`}>{v.brand} {v.model}</span>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${statusInfo.badgeClass}`}>
                              {statusInfo.statusLabel}
                            </span>
                          </div>
                          <span className={`text-[10px] font-normal ${isSelected ? 'text-indigo-500' : 'text-slate-400'}`}>
                            Placa: {v.plate} | Cor: {v.color} | Setor: {sectors.find(s => s.id === (v.sector_id || v.sectorId))?.name || 'Sem Setor'}
                          </span>
                        </div>
                        {isSelected && <Check className="w-5 h-5 text-indigo-600 shrink-0" />}
                        {!statusInfo.isAvailable && <Info className="w-4 h-4 text-slate-400 shrink-0" />}
                      </button>
                    );
                  })
                ) : (
                  vehicleSearch && (
                    <div className="p-10 text-center flex flex-col items-center">
                      <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                        <Car className="w-6 h-6 text-slate-300" />
                      </div>
                      <p className="text-sm text-slate-500 font-medium">Nenhum veículo encontrado.</p>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modals de Data */}
      <DateTimePickerModal
        isOpen={activeDateModal === 'departure'}
        onClose={() => setActiveDateModal(null)}
        onSelect={handleDepartureSelect}
        initialValue={departureDateTime}
        title="Data e Hora de Saída"
        isAdmin={currentUser?.role === 'admin'}
      />
      
      <DateTimePickerModal
        isOpen={activeDateModal === 'return'}
        onClose={() => setActiveDateModal(null)}
        onSelect={handleReturnSelect}
        initialValue={returnDateTime}
        title="Data e Hora de Retorno"
        isAdmin={currentUser?.role === 'admin'}
      />

      {/* Modal - Data da Diária Expirada (Regra dos 10 Dias) */}
      {isExpiredModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6 animate-fade-in" onClick={() => setIsExpiredModalOpen(false)}>
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-6 text-white text-center relative flex flex-col items-center">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-3 border border-white/30 shadow-inner">
                <AlertTriangle className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-black tracking-tight uppercase">Data da Diária Expirada</h3>
              <p className="text-xs text-amber-100 font-semibold mt-1">Prazo Limite Excedido</p>
              <button 
                onClick={() => setIsExpiredModalOpen(false)} 
                className="absolute top-4 right-4 p-2 text-white/80 hover:text-white bg-black/10 hover:bg-black/20 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-center">
              <div className="bg-amber-50 border border-amber-200/80 rounded-2xl p-4 text-amber-950 space-y-3 text-left">
                <div className="flex items-center justify-between border-b border-amber-200/60 pb-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-700">Fundamentação Legal</span>
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-200/60 px-2 py-0.5 rounded">Lei 1084/2017 • Decreto 64/2017</span>
                </div>
                <p className="text-xs font-semibold leading-relaxed text-amber-900 italic">
                  “Art. 38 - O prazo da prestação de contas de diárias, e das despesas relacionadas com a viagem, inclusive passagens aéreas, é de dez dias, contados da data de retorno do servidor e/ou agente político à Sede do Município.”
                </p>
              </div>

              <button
                onClick={() => setIsExpiredModalOpen(false)}
                className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl shadow-lg active:scale-[0.98] transition-all"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Modal - Sucesso no Cadastro do Evento */}
      {isSuccess && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6 animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 animate-slide-up text-center">
            <div className="bg-gradient-to-br from-emerald-500 to-teal-600 p-8 text-white flex flex-col items-center">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-4 border border-white/30 shadow-inner animate-bounce">
                <CheckCircle2 className="w-10 h-10 text-white" />
              </div>
              <h3 className="text-xl font-black tracking-tight uppercase">Solicitação Finalizada!</h3>
              <p className="text-xs text-emerald-100 font-semibold mt-2">Sua viagem foi registrada com sucesso.</p>
            </div>
            <div className="p-6">
              <p className="text-sm font-semibold text-slate-500 mb-2">Redirecionando você para o Módulo de Diárias...</p>
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mt-4"></div>
            </div>
          </div>
        </div>
      )}

      {/* Modal - Erro de Validação de Data (Regra de Negócio) */}
      {dateValidationError && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6 animate-fade-in" onClick={() => setDateValidationError(null)}>
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 animate-slide-up" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-br from-red-500 to-rose-600 p-6 text-white text-center relative flex flex-col items-center">
              <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-3 border border-white/30 shadow-inner">
                <AlertTriangle className="w-8 h-8 text-white" />
              </div>
              <h3 className="text-lg font-black tracking-tight uppercase">{dateValidationError.title}</h3>
              <p className="text-xs text-red-100 font-semibold mt-1">Ação Não Permitida</p>
              <button 
                onClick={() => setDateValidationError(null)} 
                className="absolute top-4 right-4 p-2 text-white/80 hover:text-white bg-black/10 hover:bg-black/20 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-center">
              <div className="bg-red-50 border border-red-100 rounded-2xl p-4 text-red-950 space-y-2 text-left">
                <p className="text-xs font-bold leading-relaxed text-red-900">
                  {dateValidationError.message}
                </p>
                {dateValidationError.law && (
                  <p className="text-[10px] font-semibold text-slate-500 leading-normal border-t border-red-200/50 pt-2 mt-2">
                    {dateValidationError.law}
                  </p>
                )}
              </div>

              <button
                onClick={() => setDateValidationError(null)}
                className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs uppercase tracking-widest rounded-xl shadow-lg active:scale-[0.98] transition-all"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Dinâmico de Situação do Veículo */}
      {vehicleStatusModal && (
        <div 
          className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-fade-in text-left"
          onClick={() => setVehicleStatusModal(null)}
        >
          <div 
            className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <div className={`p-6 text-white text-center relative flex flex-col items-center ${
              vehicleStatusModal.statusKey === 'em_viagem' 
                ? 'bg-rose-600' 
                : vehicleStatusModal.statusKey === 'viagem_programada' 
                  ? 'bg-amber-600' 
                  : 'bg-indigo-600'
            }`}>
              <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-3 border border-white/30 shadow-inner">
                <Car className="w-8 h-8 text-white" />
              </div>
              <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-[10px] font-black uppercase tracking-widest text-white mb-1 border border-white/30">
                Veículo com Conflito de Horário
              </span>
              <h3 className="text-lg font-black tracking-tight uppercase">{vehicleStatusModal.vehicleName}</h3>
              <p className="text-xs text-white/90 font-medium mt-0.5">Placa: {vehicleStatusModal.plate}</p>
              
              <button 
                onClick={() => setVehicleStatusModal(null)} 
                className="absolute top-4 right-4 p-2 text-white/80 hover:text-white bg-black/10 hover:bg-black/20 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Situação Atual</span>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${vehicleStatusModal.badgeClass}`}>
                    {vehicleStatusModal.statusLabel}
                  </span>
                </div>

                {vehicleStatusModal.evento && (
                  <div className="space-y-2 pt-2 border-t border-slate-200/60 text-xs">
                    <div>
                      <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Destino da Viagem Ativa</span>
                      <span className="font-bold text-slate-800">{vehicleStatusModal.evento.destino}</span>
                    </div>

                    <div>
                      <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Servidores Alocados</span>
                      <span className="font-bold text-slate-800">
                        {vehicleStatusModal.evento.pessoas?.map(p => p.name).join(', ') || vehicleStatusModal.evento.user_name}
                      </span>
                    </div>

                    {vehicleStatusModal.evento.data_saida && (
                      <div>
                        <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400">Previsão de Saída</span>
                        <span className="font-bold text-slate-800">
                          {new Date(vehicleStatusModal.evento.data_saida).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {vehicleStatusModal.evento && (
                <div className="text-xs text-slate-700 font-bold bg-indigo-50/50 p-4 border border-indigo-100 rounded-2xl leading-relaxed text-center">
                  O veículo {vehicleStatusModal.vehicleName} está {vehicleStatusModal.statusKey === 'em_viagem' ? 'em viagem' : 'programado'} com o servidor{" "}
                  <span className="text-indigo-700 font-black">
                    {vehicleStatusModal.evento.pessoas?.map(p => p.name).join(', ') || vehicleStatusModal.evento.user_name}
                  </span>
                  , para a localidade <span className="text-indigo-700 font-black">{vehicleStatusModal.evento.destino}</span> na data{" "}
                  <span className="text-indigo-700 font-black">
                    {new Date(vehicleStatusModal.evento.data_saida).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  . Você vai na mesma viagem?
                </div>
              )}

              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    const vehicleValue = `${vehicleStatusModal.vehicleName} - ${vehicleStatusModal.plate}`;
                    const vObj = vehicles.find(veh => veh.plate === vehicleStatusModal.plate);
                    if (vObj) {
                      setOverrideVehicleConflict(vObj.id);
                    }
                    setSelectedVehicle(vehicleValue);
                    setCustomVehicle('');
                    setIsVehiclesOpen(false);
                    setVehicleSearch('');
                    setVehicleStatusModal(null);
                  }}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Sim, vou na mesma viagem</span>
                </button>

                <button
                  type="button"
                  onClick={() => setVehicleStatusModal(null)}
                  className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs uppercase tracking-wider rounded-xl transition-all border border-slate-200"
                >
                  Não, escolher outro veículo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
