import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ArrowLeft, MapPin, Calendar, Clock, FileText, CheckCircle2, 
  Loader2, Search, ChevronDown, Users, X, Check, ChevronLeft,
  MessageSquare, ArrowRight, ChevronRight
} from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Person, User, Sector, Job } from '../../types';
import { createDiariaEvento } from '../../services/diariasEventosService';

const DateTimePickerModal = ({ 
  isOpen, 
  onClose, 
  onSelect, 
  initialValue, 
  title 
}: { 
  isOpen: boolean, 
  onClose: () => void, 
  onSelect: (val: string) => void, 
  initialValue: string, 
  title: string 
}) => {
  const [currentMonth, setCurrentMonth] = useState(() => initialValue ? parseISO(initialValue) : new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(() => initialValue ? parseISO(initialValue) : null);
  const [time, setTime] = useState(() => {
    if (initialValue) {
      const d = parseISO(initialValue);
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
    return '08:00';
  });

  if (!isOpen) return null;

  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });
  const startDay = startOfMonth(currentMonth).getDay();
  const paddingDays = Array.from({ length: startDay }).map((_, i) => i);

  const handleConfirm = () => {
     if (!selectedDate) return;
     const [hours, minutes] = time.split(':').map(Number);
     const finalDate = new Date(selectedDate);
     finalDate.setHours(hours, minutes, 0, 0);
     
     const formatted = format(finalDate, "yyyy-MM-dd'T'HH:mm");
     onSelect(formatted);
     onClose();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6 animate-fade-in" onClick={onClose}>
       <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
           <div className="bg-indigo-600 p-6 text-white text-center relative">
               <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-200 mb-1">{title}</h3>
               <div className="text-3xl font-black tracking-tight">
                  {selectedDate ? format(selectedDate, "dd 'de' MMM", { locale: ptBR }) : 'Selecione'}
               </div>
               <div className="text-lg font-medium text-indigo-200 mt-1">
                  {time}
               </div>
               <button onClick={onClose} className="absolute top-4 right-4 p-2 text-indigo-200 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-colors">
                 <X className="w-5 h-5" />
               </button>
           </div>
           
           <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                 <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                 </button>
                 <span className="font-bold text-slate-800 capitalize">
                    {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
                 </span>
                 <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-slate-100 rounded-full text-slate-600 transition-colors">
                    <ChevronRight className="w-5 h-5" />
                 </button>
              </div>

              <div>
                 <div className="grid grid-cols-7 gap-1 mb-2">
                    {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((d, i) => (
                       <div key={i} className="text-center text-xs font-bold text-slate-400">{d}</div>
                    ))}
                 </div>
                 <div className="grid grid-cols-7 gap-1">
                    {paddingDays.map(i => <div key={`pad-${i}`} />)}
                    {days.map(d => {
                       const isSelected = selectedDate && isSameDay(d, selectedDate);
                       const isToday = isSameDay(d, new Date());
                       return (
                         <button
                           key={d.toISOString()}
                           onClick={() => setSelectedDate(d)}
                           className={`w-8 h-8 mx-auto flex items-center justify-center rounded-full text-sm transition-all ${
                             isSelected ? 'bg-indigo-600 text-white font-bold shadow-md scale-110' :
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

              <div className="pt-4 border-t border-slate-100 flex flex-col items-center gap-3">
                 <label className="text-xs font-bold uppercase tracking-widest text-slate-400">Horário</label>
                 <input 
                   type="time" 
                   value={time}
                   onChange={e => setTime(e.target.value)}
                   className="text-2xl font-black text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-center w-full max-w-[160px]"
                 />
              </div>

              <button 
                 onClick={handleConfirm}
                 disabled={!selectedDate || !time}
                 className="w-full py-3.5 bg-slate-900 text-white font-bold rounded-xl shadow-lg hover:bg-slate-800 hover:shadow-xl active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                 Confirmar
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
  const [selectedPerson, setSelectedPerson] = useState<{ id: string; name: string } | null>(null);
  const [destination, setDestination] = useState('');
  const [departureDateTime, setDepartureDateTime] = useState('');
  const [returnDateTime, setReturnDateTime] = useState('');
  const [reason, setReason] = useState('');

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  
  const [currentStep, setCurrentStep] = useState(1);
  const isStep1Valid = selectedPerson !== null && destination && departureDateTime && returnDateTime;
  
  // States for city modal
  const [cities, setCities] = useState<string[]>([]);
  const [isCityLoading, setIsCityLoading] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [isCityOpen, setIsCityOpen] = useState(false);

  // States for persons single-select modal
  const [isPersonsOpen, setIsPersonsOpen] = useState(false);
  const [personSearch, setPersonSearch] = useState('');

  // States for date modals
  const [activeDateModal, setActiveDateModal] = useState<'departure' | 'return' | null>(null);

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

  const normalizeText = (text: string) => {
    return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\w\s]|_/g, "").toLowerCase();
  };

  const filteredCities = useMemo(() => {
    let list = [...cities];
    if (citySearch) {
      const term = normalizeText(citySearch);
      list = list.filter(city => normalizeText(city).includes(term));
    }
    return list.sort((a, b) => a.localeCompare(b));
  }, [cities, citySearch]);

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

  const isFormValid = selectedPerson !== null && destination && departureDateTime && returnDateTime && reason.trim().length > 0;

  const handleSubmit = async () => {
    if (!isFormValid || !currentUser) return;
    setIsLoading(true);
    
    try {
      await createDiariaEvento({
        pessoas: selectedPerson ? [selectedPerson] : [],
        destino: destination,
        data_saida: departureDateTime,
        data_retorno: returnDateTime,
        motivo: reason.trim(),
        setor_id: currentUser.sectorId,
        user_id: currentUser.id,
        user_name: currentUser.name,
      });
      
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        if (onFinish) onFinish();
        else onBack();
      }, 2000);
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

  return (
    <div className="flex flex-col h-full bg-slate-50 w-full relative">
      
      {/* NEW HEADER LAYOUT: Back Button | Stepper | Action Button */}
      <div className="sticky top-0 z-40 bg-white border-b border-slate-200 px-6 py-1 flex items-center gap-6 shadow-sm min-h-[50px]">
          {/* 1. Voltar (Padrão) */}
          <button onClick={onBack} disabled={isLoading} className={`flex items-center gap-2 group px-3 py-2 transition-all font-black uppercase tracking-tighter text-[11px] ${isLoading ? 'text-slate-200 cursor-not-allowed' : 'text-slate-400 hover:text-slate-900'}`} title="Voltar para Diárias">
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span>Voltar</span>
          </button>

          {/* 2. Stepper */}
          <div className="flex-1 flex justify-center">
              <div className="w-full max-w-lg py-4">
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
                                      className={`flex flex-col items-center gap-2 relative z-10 cursor-pointer group px-2 bg-white rounded-xl transition-all duration-300 ${status === 'current' ? 'scale-110' : 'hover:scale-105'}`}
                                  >
                                      <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-sm ${circleClass}`}>
                                          <Icon className="w-5 h-5" />
                                      </div>
                                      <span className={`text-[10px] uppercase tracking-wider transition-colors bg-white ${labelClass}`}>
                                          {step.label}
                                      </span>
                                  </div>

                                  {!isLast && (
                                      <div className="flex-1 h-1 mx-2 rounded-full overflow-hidden bg-slate-100 relative -z-10">
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
          <div className="min-w-[140px] flex justify-end">
              {currentStep === 1 ? (
                  <button
                      onClick={() => setCurrentStep(2)}
                      disabled={!isStep1Valid || isLoading}
                      className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 shadow-lg shadow-slate-900/20 active:scale-95 transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                      Avançar
                      <ChevronRight className="w-4 h-4" />
                  </button>
              ) : (
                  <button
                      onClick={handleSubmit}
                      disabled={!isFormValid || isLoading || isSuccess}
                      className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 active:scale-95 transition-all text-sm animate-pulse disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                      {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      {isLoading ? 'Salvando...' : 'Finalizar'}
                  </button>
              )}
          </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 bg-slate-50" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        <style>{`
          .hide-scroll::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        <div className="w-full max-w-4xl mx-auto space-y-6 hide-scroll">
          
          <div className="space-y-3 mb-6">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Registrar Nova Viagem</h1>
            <p className="text-slate-500 font-medium text-sm">Preencha os detalhes abaixo para solicitar a autorização do evento e viagem oficial.</p>
          </div>

          <div className="w-full bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
            
            
            {currentStep === 1 && (
              <div className="space-y-6 animate-fade-in">
                
                {/* Pessoas */}
                <div className="relative space-y-3">
                  <label className={labelClass}>Pessoa Selecionada</label>
                  <div 
                    onClick={() => setIsPersonsOpen(true)}
                    className={`${inputContainerClass} cursor-pointer ${isPersonsOpen ? 'bg-white border-indigo-500 ring-4 ring-indigo-500/5' : ''}`}
                  >
                    <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    <span className={`w-full bg-transparent pl-11 pr-10 py-3 text-sm font-medium outline-none truncate ${selectedPerson ? 'text-slate-900' : 'text-slate-500'}`}>
                      {selectedPerson ? selectedPerson.name : 'Clique para selecionar o servidor...'}
                    </span>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    </div>
                  </div>
                </div>

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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              <div className="space-y-3">
                <label className={labelClass}>Retorno</label>
                <div 
                  onClick={() => setActiveDateModal('return')}
                  className={`${inputContainerClass} cursor-pointer ${activeDateModal === 'return' ? 'bg-white border-indigo-500 ring-4 ring-indigo-500/5' : ''}`}
                >
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  <span className={`w-full bg-transparent pl-11 pr-10 py-3 text-sm font-medium outline-none truncate ${returnDateTime ? 'text-slate-900' : 'text-slate-500'}`}>
                    {returnDateTime ? format(parseISO(returnDateTime), "dd/MM/yyyy 'às' HH:mm") : 'Selecione a data de retorno'}
                  </span>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </div>
                </div>
              </div>
            </div>
              </div>
            </div>
            )}

            {currentStep === 2 && (
            <div className="space-y-8 animate-fade-in">
              {/* Motivo */}
              <div className="space-y-3">
                <label className={labelClass}>Motivo da Viagem</label>
                <div className={`${inputContainerClass} items-start`}>
                  <FileText className="absolute left-4 top-4 w-4 h-4 text-slate-400 pointer-events-none" />
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Descreva detalhadamente o objetivo da viagem e a agenda do evento..."
                    className={`${inputClass} min-h-[160px] resize-none leading-relaxed`}
                  />
                </div>
              </div>
            </div>
            )}

          </div>
        </div>
      </div>

      {/* Modal - Selecionar Pessoa */}
      {isPersonsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6 animate-fade-in" onClick={() => setIsPersonsOpen(false)}>
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
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
                autoFocus
                className="w-full bg-slate-50 border border-slate-200 pl-10 pr-4 py-3 rounded-xl text-sm font-medium text-slate-900 outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-2" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              <style>{`.hide-scroll::-webkit-scrollbar { display: none; }`}</style>
              <div className="hide-scroll space-y-1">
                {filteredPersons.length > 0 ? (
                  filteredPersons.map((person) => {
                    const isSelected = selectedPerson?.id === person.id;
                    return (
                      <button
                        key={person.id}
                        onClick={() => {
                          setSelectedPerson({ id: person.id, name: person.name });
                          setIsPersonsOpen(false);
                          setPersonSearch('');
                        }}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left text-sm font-medium transition-all group ${isSelected ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'}`}
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6 animate-fade-in" onClick={() => setIsCityOpen(false)}>
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden" onClick={e => e.stopPropagation()}>
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
                autoFocus
                className="w-full bg-slate-50 border border-slate-200 pl-10 pr-4 py-3 rounded-xl text-sm font-medium text-slate-900 outline-none focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all"
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
                          setIsCityOpen(false);
                          setCitySearch('');
                        }}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left text-sm font-medium transition-all group ${isSelected ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'}`}
                      >
                        <span className={`${isSelected ? 'font-bold' : ''}`}>{city}</span>
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

      {/* Modals de Data */}
      <DateTimePickerModal
        isOpen={activeDateModal === 'departure'}
        onClose={() => setActiveDateModal(null)}
        onSelect={setDepartureDateTime}
        initialValue={departureDateTime}
        title="Data e Hora de Saída"
      />
      
      <DateTimePickerModal
        isOpen={activeDateModal === 'return'}
        onClose={() => setActiveDateModal(null)}
        onSelect={setReturnDateTime}
        initialValue={returnDateTime}
        title="Data e Hora de Retorno"
      />

    </div>
  );
};
