import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  ArrowLeft, MapPin, Calendar, Clock, FileText, CheckCircle2, 
  Loader2, Search, ChevronDown, Users, X, Check, ChevronLeft,
  MessageSquare, ArrowRight, ChevronRight, Car, AlertTriangle,
  Bed, Plus, Minus
} from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Person, User, Sector, Job, Vehicle } from '../../types';
import { createDiariaEvento } from '../../services/diariasEventosService';
import { useCachedVehicles } from '../../hooks/useCachedVehicles';
import { supabase } from '../../services/supabaseClient';
import { motion, AnimatePresence } from 'framer-motion';


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
  const normalizeName = (n: string) => {
    return n.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  };

  const [selectedPerson, setSelectedPerson] = useState<{ id: string; name: string } | null>(() => {
    if (currentUser) {
      const match = persons.find(p => normalizeName(p.name) === normalizeName(currentUser.name));
      if (match) return { id: match.id, name: match.name };
      return { id: currentUser.id, name: currentUser.name };
    }
    return null;
  });
  const [destination, setDestination] = useState('');
  const [departureDateTime, setDepartureDateTime] = useState('');
  const [returnDateTime, setReturnDateTime] = useState('');
  const [reason, setReason] = useState('');
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

  const isGestorOrAdmin = currentUser && (
    currentUser.role === 'admin' || 
    currentUser.permissions?.includes('parent_diarias_gestores') || 
    currentUser.permissions?.includes('parent_diarias')
  );

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
    if (!val) {
      setDepartureDateTime('');
      return;
    }

    const isAdmin = currentUser && currentUser.role === 'admin';
    const selectedDateTime = parseISO(val);

    // 1. Regra absoluta (válida até mesmo para Administradores):
    // Validar se a data de saída é posterior à data de retorno (se o retorno já estiver definido)
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

    // 2. Regras restritas para usuários comuns (Administradores têm bypass):
    if (!isAdmin) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const selectedDateOnly = new Date(selectedDateTime.getFullYear(), selectedDateTime.getMonth(), selectedDateTime.getDate());

      // Validar se a data de saída é anterior a hoje
      if (selectedDateOnly.getTime() < today.getTime()) {
        setDateValidationError({
          title: "Data de Saída Inválida",
          message: "Não é permitido agendar uma viagem com data de saída anterior ao dia de hoje.",
          law: "Lançamentos retroativos são de permissão exclusiva da administração."
        });
        return;
      }

      // Validar se a hora de saída é anterior à hora atual (na data de hoje)
      if (selectedDateOnly.getTime() === today.getTime()) {
        if (selectedDateTime.getTime() < now.getTime()) {
          setDateValidationError({
            title: "Horário de Saída Inválido",
            message: "Para viagens iniciando no dia de hoje, a hora de saída não pode ser anterior ao horário atual.",
            law: `Horário selecionado: ${format(selectedDateTime, "HH:mm")} • Horário atual: ${format(now, "HH:mm")}`
          });
          return;
        }
      }
    }

    setDepartureDateTime(val);
  };

  const handleReturnSelect = (val: string) => {
    if (!val) {
      setReturnDateTime('');
      return;
    }

    const isAdmin = currentUser && currentUser.role === 'admin';
    const selectedReturnDateTime = parseISO(val);

    // 1. Regra absoluta (válida até mesmo para Administradores):
    // Validar se o retorno é anterior à saída (se a saída já estiver definida)
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

    // 2. Regras restritas para usuários comuns (Administradores têm bypass):
    if (isDateExpired(val) && !isAdmin) {
      setReturnDateTime('');
      setIsExpiredModalOpen(true);
      return;
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
  
  // Verifica se o servidor selecionado é diferente do usuário logado
  const isOutroServidor = !!(selectedPerson && currentUser && selectedPerson.id !== currentUser.id);

  const isStep1Valid = selectedPerson !== null && 
    destination && 
    departureDateTime && 
    (!returnDateTime || !isDateExpired(returnDateTime)) &&
    (selectedVehicle !== '' && (selectedVehicle !== 'OUTRO' || customVehicle.trim() !== '')) &&
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
    if (currentUser && persons.length > 0) {
      const isPersonInList = selectedPerson ? persons.some(p => p.id === selectedPerson.id) : false;
      if (!isPersonInList) {
        const match = persons.find(p => normalizeName(p.name) === normalizeName(currentUser.name));
        if (match) {
          setSelectedPerson({ id: match.id, name: match.name });
        }
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
    const term = normalizeText(vehicleSearch);
    if (!term) return vehicles;
    return vehicles.filter(v => 
      normalizeText(`${v.brand} ${v.model} ${v.plate}`).includes(term)
    );
  }, [vehicles, vehicleSearch]);

  const isFormValid = isStep1Valid && reason.trim().length >= 30;

  const handleSubmit = async () => {
    if (returnDateTime && isDateExpired(returnDateTime) && currentUser?.role !== 'admin') {
      setIsExpiredModalOpen(true);
      return;
    }
    if (!isFormValid || !currentUser) return;
    setIsLoading(true);
    
    const hasReturn = !!returnDateTime.trim();

    try {
      await createDiariaEvento({
        pessoas: selectedPerson ? [selectedPerson] : [],
        destino: destination,
        data_saida: departureDateTime,
        // Se o campo RETORNO estiver preenchido, salva a data; caso contrário (data futura sem retorno), salva sentinela para o fluxo Viajar
        data_retorno: hasReturn ? returnDateTime : '2099-12-31T00:00:00.000Z',
        motivo: reason.trim(),
        setor_id: currentUser.sectorId,
        user_id: currentUser.id,
        user_name: currentUser.name,
        // Se o retorno foi preenchido, vai direto para 'aguardando_gestor' (não vai para /Diarias/Viajar);
        // Se não tiver retorno preenchido, ativa o fluxo 'viagem_programada' para o card /Diarias/Viajar
        status: hasReturn ? 'aguardando_gestor' : 'viagem_programada',
        hospedagem,
        hospedagem_dias: hospedagem ? hospedagemDias : 0,
        veiculo: selectedVehicle,
        veiculo_outro: selectedVehicle === 'OUTRO' ? customVehicle : '',
        distancia: Number(distancia) || 0
      });
      
      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        window.history.pushState({}, '', '/Diarias/Lancamentos');
        window.dispatchEvent(new Event('popstate'));
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

  const isMobileStepValid = (step: number) => {
    switch (step) {
      case 1:
        return selectedPerson !== null;
      case 2:
        return destination !== '' && !isCalculatingDistance;
      case 3:
        return departureDateTime !== '';
      case 4:
        return !returnDateTime || !isDateExpired(returnDateTime);
      case 5:
        return !hospedagem || (hospedagem && hospedagemDias > 0);
      case 6:
        return selectedVehicle !== '' && (selectedVehicle !== 'OUTRO' || customVehicle.trim() !== '');
      case 7:
        return reason.trim().length >= 30;
      case 8:
        return isFormValid;
      default:
        return false;
    }
  };

  if (isMobile) {
    const totalMobileSteps = 8;
    const canChangePerson = currentUser && (currentUser.role === 'admin' || currentUser.permissions?.includes('parent_diarias'));
    const selectedPersonData = selectedPerson ? persons.find(p => p.id === selectedPerson.id) : null;
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
      <div className="flex flex-col h-[100dvh] bg-slate-100 w-full relative overflow-hidden">
        
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
                {mobileStep === 1 && "Servidor"}
                {mobileStep === 2 && "Destino"}
                {mobileStep === 3 && "Data de Saída"}
                {mobileStep === 4 && "Data de Retorno"}
                {mobileStep === 5 && "Hospedagem"}
                {mobileStep === 6 && "Veículo"}
                {mobileStep === 7 && "Motivo"}
                {mobileStep === 8 && "Revisão"}
              </h2>
            </div>
            
            <div className="w-10" /> {/* Espaçador para equilibrar o layout */}
          </div>
        </div>

        {/* Área central com animações */}
        <div className="flex-1 flex flex-col justify-between p-4 overflow-y-auto min-h-0">
          <div className="flex-1 flex flex-col justify-start items-center pt-2 pb-4 relative min-h-[350px]">
            <AnimatePresence initial={false} custom={direction} mode="wait">
              <motion.div
                key={mobileStep}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className={`w-full max-w-sm bg-white border border-slate-200/80 rounded-3xl shadow-xl flex flex-col items-center justify-start text-center absolute top-0 ${
                  mobileStep === 8 ? 'p-4 space-y-3' : 'p-6 space-y-5'
                }`}
              >
                
                {/* PASSO 1: SERVIDOR */}
                {mobileStep === 1 && (
                  <div className="w-full space-y-6">
                    <div className="space-y-2">
                      <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto text-indigo-600 shadow-inner">
                        <Users className="w-7 h-7" />
                      </div>
                      <h3 className="text-xl font-black text-slate-900 tracking-tight">Quem realizará a viagem?</h3>
                      <p className="text-slate-500 text-xs font-medium max-w-xs mx-auto">Selecione o servidor beneficiário das diárias para esta viagem.</p>
                    </div>

                    <div 
                      onClick={() => canChangePerson && setIsPersonsOpen(true)}
                      className={`w-full p-5 rounded-2xl border text-left transition-all ${
                        canChangePerson 
                          ? 'bg-slate-50/90 border-slate-200/80 hover:border-indigo-500 hover:ring-4 hover:ring-indigo-500/5 cursor-pointer shadow-sm active:scale-[0.98]' 
                          : 'bg-slate-100/80 border-slate-200/60 cursor-not-allowed'
                      }`}
                    >
                      <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1">Servidor Selecionado</span>
                      <span className="block text-base font-bold text-slate-800 break-words">
                        {selectedPerson ? selectedPerson.name : 'Selecionar Servidor...'}
                      </span>
                      <span className="block text-xs text-slate-500 font-medium mt-1">
                        Cargo: {selectedPersonJob}
                      </span>
                      {canChangePerson && (
                        <span className="block text-[10px] text-indigo-600 font-bold mt-3 text-right">Toque para alterar →</span>
                      )}
                    </div>
                  </div>
                )}

                {/* PASSO 2: DESTINO */}
                {mobileStep === 2 && (
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

                {/* PASSO 3: DATA DE SAÍDA */}
                {mobileStep === 3 && (
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

                {/* PASSO 4: DATA DE RETORNO */}
                {mobileStep === 4 && (
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

                {/* PASSO 5: HOSPEDAGEM */}
                {mobileStep === 5 && (
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

                {/* PASSO 6: VEÍCULO */}
                {mobileStep === 6 && (
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
                          ? 'OUTRO (Especificar...)' 
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
                          <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Detalhes do Veículo (Outro)</label>
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

                {/* PASSO 7: MOTIVO DA VIAGEM */}
                {mobileStep === 7 && (
                  <div className="w-full space-y-6">
                    <div className="space-y-2">
                      <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto text-indigo-600 shadow-inner">
                        <FileText className="w-7 h-7" />
                      </div>
                      <h3 className="text-xl font-black text-slate-900 tracking-tight">Qual o motivo da viagem?</h3>
                      <p className="text-slate-500 text-xs font-medium max-w-xs mx-auto">Forneça justificativa pública detalhada (mínimo de 30 caracteres).</p>
                    </div>

                    <div className="w-full text-left space-y-2">
                      <div className="relative flex items-start w-full bg-slate-50/90 border border-slate-200/80 rounded-2xl p-4 focus-within:border-indigo-500 focus-within:ring-4 focus-within:ring-indigo-500/5 transition-all shadow-sm">
                        <MessageSquare className="w-4 h-4 text-slate-400 shrink-0 mr-3 mt-1" />
                        <textarea
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="Descreva a agenda do evento, reuniões ou atividades a serem realizadas no destino..."
                          className="w-full min-h-[140px] bg-transparent text-base font-medium text-slate-900 outline-none resize-none leading-relaxed"
                        />
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-bold px-1 mt-1">
                        <span className={reason.trim().length >= 30 ? "text-emerald-600" : "text-amber-600"}>
                          {reason.trim().length >= 30 ? "Requisito mínimo atingido!" : `Faltam ${30 - reason.trim().length} caracteres`}
                        </span>
                        <span className="text-slate-400 font-mono">
                          {reason.trim().length} / 30
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* PASSO 8: RESUMO & ENVIO */}
                {mobileStep === 8 && (
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
                        <span className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-0.5">Servidor</span>
                        <p className="text-sm font-bold text-slate-800">{selectedPerson?.name}</p>
                        <p className="text-[10px] text-slate-500 font-semibold">{selectedPersonJob}</p>
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

          {/* Botões de Ação Inferiores do Mobile */}
          <div className="pt-4 pb-10 px-2 border-t border-slate-200/60 flex items-center gap-4 w-full bg-slate-100 sticky bottom-0 shrink-0">
            <button
              type="button"
              onClick={handleMobileBack}
              disabled={isLoading}
              className="flex items-center justify-center gap-1.5 py-4 px-5 bg-white border border-slate-200 text-slate-600 font-black uppercase tracking-widest text-[10px] rounded-2xl active:bg-slate-50 disabled:opacity-50 transition-all shadow-sm"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Voltar</span>
            </button>

            {mobileStep < totalMobileSteps ? (
              <button
                type="button"
                onClick={handleMobileNext}
                disabled={!isMobileStepValid(mobileStep) || isLoading}
                className="flex-1 flex items-center justify-center gap-1.5 py-4 px-6 bg-slate-900 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl active:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-md shadow-slate-950/15"
              >
                <span>Avançar</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!isFormValid || isLoading || isSuccess}
                className="flex-1 flex items-center justify-center gap-1.5 py-4 px-6 bg-emerald-600 text-white font-black uppercase tracking-widest text-[10px] rounded-2xl active:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-600/20"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>{isLoading ? 'Enviando...' : 'Finalizar'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Modais reaproveitados */}
        {isPersonsOpen && (
          <div className="fixed inset-0 z-[100] flex items-start sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 pt-12 sm:p-6 animate-fade-in" onClick={() => setIsPersonsOpen(false)}>
            <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col h-[70vh] sm:h-auto sm:max-h-[85vh] overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
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
                          <span className={`${isSelected ? 'font-bold' : ''}`}>OUTRO</span>
                          <span className={`text-[10px] font-normal ${isSelected ? 'text-indigo-500' : 'text-slate-400'}`}>
                            Especificar veículo personalizado
                          </span>
                        </div>
                        {isSelected && <Check className="w-5 h-5 text-indigo-600" />}
                      </button>
                    );
                  })()}

                  {filteredVehicles.length > 0 ? (
                    filteredVehicles.map((v) => {
                      const vehicleValue = `${v.brand} ${v.model} - ${v.plate}`;
                      const isSelected = selectedVehicle === vehicleValue;
                      return (
                        <button
                          key={v.id}
                          onClick={() => {
                            setSelectedVehicle(vehicleValue);
                            setCustomVehicle('');
                            setIsVehiclesOpen(false);
                            setVehicleSearch('');
                          }}
                          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left text-sm font-medium transition-all group ${isSelected ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'}`}
                        >
                          <div className="flex flex-col">
                            <span className={`${isSelected ? 'font-bold' : ''}`}>{v.brand} {v.model}</span>
                            <span className={`text-[10px] font-normal ${isSelected ? 'text-indigo-500' : 'text-slate-400'}`}>
                              Placa: {v.plate} | Cor: {v.color} | Setor: {sectors.find(s => s.id === (v.sector_id || v.sectorId))?.name || 'Sem Setor'}
                            </span>
                          </div>
                          {isSelected && <Check className="w-5 h-5 text-indigo-600" />}
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
        />
        
        <DateTimePickerModal
          isOpen={activeDateModal === 'return'}
          onClose={() => setActiveDateModal(null)}
          onSelect={handleReturnSelect}
          initialValue={returnDateTime}
          title="Data e Hora de Retorno"
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
                <p className="text-sm font-semibold text-slate-500 mb-2">Redirecionando você para a tela de Lançamentos...</p>
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
                        if (returnDateTime && isDateExpired(returnDateTime) && currentUser?.role !== 'admin') {
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
                  const canChangePerson = currentUser && (currentUser.role === 'admin' || currentUser.permissions.includes('parent_diarias'));
                  const selectedPersonData = selectedPerson ? persons.find(p => p.id === selectedPerson.id) : null;
                  const selectedPersonJob = selectedPersonData 
                    ? (jobs.find(j => j.id === selectedPersonData.jobId)?.name || 'Sem Cargo')
                    : 'Sem Cargo';

                  return (
                    <>
                      <div className="relative space-y-3">
                        <label className={labelClass}>Servidor</label>
                        <div 
                          onClick={() => {
                            if (canChangePerson) {
                              setIsPersonsOpen(true);
                            }
                          }}
                          className={`${inputContainerClass} ${canChangePerson ? 'cursor-pointer' : 'bg-slate-100/80 border-slate-200 cursor-not-allowed'} ${isPersonsOpen && canChangePerson ? 'bg-white border-indigo-500 ring-4 ring-indigo-500/5' : ''}`}
                        >
                          <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                          <span className={`w-full bg-transparent pl-11 pr-10 py-3 text-sm font-medium outline-none truncate ${selectedPerson ? (canChangePerson ? 'text-slate-900' : 'text-slate-500') : 'text-slate-500'}`}>
                            {selectedPerson ? selectedPerson.name : 'Clique para selecionar o servidor...'}
                          </span>
                          {canChangePerson && (
                            <div className="absolute right-4 top-1/2 -translate-y-1/2">
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="relative space-y-3">
                        <label className={labelClass}>Cargo</label>
                        <div className={`${inputContainerClass} bg-slate-100/80 border-slate-200 cursor-not-allowed`}>
                          <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                          <input
                            type="text"
                            readOnly
                            value={selectedPersonJob}
                            className={`${inputClass} text-slate-500 cursor-not-allowed`}
                          />
                        </div>
                      </div>
                    </>
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
            </div>
          </div>

              {/* Hospedagem */}
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
                      ? 'OUTRO (Especificar...)' 
                      : (selectedVehicle || 'Clique para selecionar o veículo...')}
                  </span>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </div>
                </div>

                {selectedVehicle === 'OUTRO' && (
                  <div className="space-y-2 mt-2 animate-fade-in">
                    <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400">Especificar Veículo</label>
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
                <div className={`${inputContainerClass} items-start`}>
                  <FileText className="absolute left-4 top-4 w-4 h-4 text-slate-400 pointer-events-none" />
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Descreva detalhadamente o objetivo da viagem e a agenda do evento..."
                    className={`${inputClass} min-h-[160px] resize-none leading-relaxed`}
                  />
                </div>
                <div className="flex justify-between items-center text-[10px] font-bold mt-1 px-1">
                  <span className={reason.trim().length >= 30 ? "text-emerald-600" : "text-amber-600"}>
                    {reason.trim().length >= 30 ? "Requisito mínimo de caracteres atingido!" : `Mínimo de 30 caracteres necessário (faltam ${30 - reason.trim().length} caracteres)`}
                  </span>
                  <span className="text-slate-400 font-mono">
                    {reason.trim().length} / 30
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
                        <span className={`${isSelected ? 'font-bold' : ''}`}>OUTRO</span>
                        <span className={`text-[10px] font-normal ${isSelected ? 'text-indigo-500' : 'text-slate-400'}`}>
                          Especificar veículo personalizado
                        </span>
                      </div>
                      {isSelected && <Check className="w-5 h-5 text-indigo-600" />}
                    </button>
                  );
                })()}

                {filteredVehicles.length > 0 ? (
                  filteredVehicles.map((v) => {
                    const vehicleValue = `${v.brand} ${v.model} - ${v.plate}`;
                    const isSelected = selectedVehicle === vehicleValue;
                    return (
                      <button
                        key={v.id}
                        onClick={() => {
                          setSelectedVehicle(vehicleValue);
                          setCustomVehicle('');
                          setIsVehiclesOpen(false);
                          setVehicleSearch('');
                        }}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-left text-sm font-medium transition-all group ${isSelected ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'}`}
                      >
                        <div className="flex flex-col">
                          <span className={`${isSelected ? 'font-bold' : ''}`}>{v.brand} {v.model}</span>
                          <span className={`text-[10px] font-normal ${isSelected ? 'text-indigo-500' : 'text-slate-400'}`}>
                            Placa: {v.plate} | Cor: {v.color} | Setor: {sectors.find(s => s.id === (v.sector_id || v.sectorId))?.name || 'Sem Setor'}
                          </span>
                        </div>
                        {isSelected && <Check className="w-5 h-5 text-indigo-600" />}
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
      />
      
      <DateTimePickerModal
        isOpen={activeDateModal === 'return'}
        onClose={() => setActiveDateModal(null)}
        onSelect={handleReturnSelect}
        initialValue={returnDateTime}
        title="Data e Hora de Retorno"
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
              <p className="text-sm font-semibold text-slate-500 mb-2">Redirecionando você para a tela de Lançamentos...</p>
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

    </div>
  );
};
