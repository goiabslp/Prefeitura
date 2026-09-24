import React, { useState, useMemo, useEffect } from 'react';
import { 
  ArrowLeft, 
  Calendar as CalendarIcon, 
  Clock, 
  Search, 
  Car, 
  CheckCircle2, 
  Users, 
  Tag, 
  CalendarDays,
  AlertCircle,
  Sparkles,
  Info,
  CalendarCheck,
  Building2,
  X,
  MapPin,
  User,
  UserPlus,
  Plus,
  Trash2,
  Loader2,
  Navigation,
  ShieldCheck,
  Check,
  ArrowRight,
  ChevronRight,
  Compass
} from 'lucide-react';
import { DateTimePickerModal } from '../DateTimePickerModal';
import { supabase } from '../../services/supabaseClient';
import { Vehicle, Person, Sector, CrewMember } from '../../types';
import { notificationService } from '../../services/notificationService';

interface ConsultarVeiculoScreenProps {
  sectors?: { id: string; name: string }[];
  persons?: Person[];
  vehicles?: Vehicle[];
  onBack: () => void;
  onSelectVehicleToSchedule?: (vehicleId: string, date: string, startTime: string, endTime: string, destination?: string, passengerCount?: number) => void;
  onNavigate?: (path: string) => void;
  currentUserId?: string;
  currentUserName?: string;
}

// Interface para os veículos totalmente livres
interface VeiculoLivreItem {
  type: 'livre';
  id: string;
  model: string;
  brand: string;
  plate: string;
  vehicleType?: string;
  vehicleCategory?: string;
  passengerCapacity: number;
  year?: number;
  color?: string;
  sectorId?: string;
  sectorName?: string;
}

// Interface para viagens já agendadas que possuem vagas compatíveis
interface ViagemExistenteItem {
  type: 'viagem_existente';
  id: string;
  scheduleId: string;
  protocol: string;
  vehicleId: string;
  vehicleModel: string;
  vehicleBrand: string;
  vehiclePlate: string;
  vehicleCategory?: string;
  vehicleColor?: string;
  driverId?: string;
  driverName?: string;
  serviceSectorId?: string;
  serviceSectorName?: string;
  departureDateTime: string;
  returnDateTime: string;
  destination: string;
  purpose: string;
  totalCapacity: number;
  occupiedSeats: number;
  remainingSeats: number;
  confirmedPassengers: CrewMember[];
}

type ResultadoConsultaItem = VeiculoLivreItem | ViagemExistenteItem;

// Cidades padrão pré-configuradas para busca rápida
const POPULAR_CITIES = [
  'BELO HORIZONTE - MG',
  'IPATINGA - MG',
  'JOÃO MONLEVADE - MG',
  'PONTE NOVA - MG',
  'ITABIRA - MG',
  'SÃO JOSÉ DO GOIABAL - MG',
  'RIO PIRACICABA - MG',
  'ALVINÓPOLIS - MG',
  'DOM SILVÉRIO - MG',
  'DIONÍSIO - MG',
  'SÃO DOMINGOS DO PRATA - MG',
  'CORONEL FABRICIANO - MG',
  'TIMÓTEO - MG',
  'VIÇOSA - MG',
  'GOVERNADOR VALADARES - MG'
];

// Helper para normalização rigorosa de nomes de cidades e destinos
export const normalizeCity = (city?: string | null): string => {
  if (!city) return '';
  return city
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/-\s*[A-Z]{2}$/g, '') // remove sufíxo " - MG", etc.
    .replace(/[^A-Z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
};

// Helper para normalização de setor
const normalizeSectorText = (str?: string | null): string => {
  if (!str) return '';
  return str
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
};

export const ConsultarVeiculoScreen: React.FC<ConsultarVeiculoScreenProps> = ({
  sectors: propSectors,
  persons: propPersons = [],
  onBack,
  onSelectVehicleToSchedule,
  onNavigate,
  currentUserId,
  currentUserName
}) => {
  // 1. Setores
  const [availableSectors, setAvailableSectors] = useState<{ id: string; name: string }[]>([]);
  const [selectedSectorId, setSelectedSectorId] = useState<string>('');

  // 2. Data e Horários da Consulta
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [horaInicial, setHoraInicial] = useState<string>('08:00');
  const [horaFinal, setHoraFinal] = useState<string>('12:00');

  // 3. Modal da Etapa 2 da Pesquisa (Quantidade de Passageiros + Destino)
  const [isSearchDetailsModalOpen, setIsSearchDetailsModalOpen] = useState(false);
  const [searchPassengerCount, setSearchPassengerCount] = useState<number>(1);
  const [searchDestination, setSearchDestination] = useState<string>('');
  const [availableCities, setAvailableCities] = useState<string[]>(POPULAR_CITIES);

  // 4. Estados de Execução da Consulta e Resultados
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [resultItems, setResultItems] = useState<ResultadoConsultaItem[]>([]);
  const [activeFilterTab, setActiveFilterTab] = useState<'todos' | 'livres' | 'viagens'>('todos');
  const [lastSearchParams, setLastSearchParams] = useState<{
    dateStr: string;
    startTime: string;
    endTime: string;
    passengers: number;
    destination: string;
  } | null>(null);

  // 5. Modal de Adicionar Passageiros à Viagem Existente
  const [selectedTripForInclusion, setSelectedTripForInclusion] = useState<ViagemExistenteItem | null>(null);
  const [isInclusionModalOpen, setIsInclusionModalOpen] = useState(false);
  const [inclusionPassengers, setInclusionPassengers] = useState<Array<{
    name: string;
    type: 'paciente' | 'acompanhante' | 'passageiro';
    departureLocation: string;
    appointmentLocation: string;
    appointmentTime: string;
  }>>([]);
  const [isInclusionSubmitting, setIsInclusionSubmitting] = useState(false);
  const [inclusionSuccessMessage, setInclusionSuccessMessage] = useState<string | null>(null);

  // Carrega lista de setores
  useEffect(() => {
    let isMounted = true;
    const fetchSectors = async () => {
      try {
        const { data, error } = await supabase
          .from('sectors')
          .select('id, name')
          .order('name', { ascending: true });
        
        if (!error && data && data.length > 0 && isMounted) {
          setAvailableSectors(data);
          return;
        }
      } catch (err) {
        console.error('[ConsultarVeiculo] Erro ao carregar setores:', err);
      }
      if (propSectors && propSectors.length > 0 && isMounted) {
        setAvailableSectors(propSectors);
      }
    };
    fetchSectors();
    return () => { isMounted = false; };
  }, [propSectors]);

  // Carrega cidades do IBGE com fallback
  useEffect(() => {
    let isMounted = true;
    const fetchCities = async () => {
      try {
        const resp = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/municipios');
        if (resp.ok) {
          const data = await resp.json();
          const list = data.map((c: any) => `${(c.nome || '').toUpperCase()} - ${c.microrregiao?.mesorregiao?.UF?.sigla || 'MG'}`);
          if (isMounted) {
            setAvailableCities(Array.from(new Set([...POPULAR_CITIES, ...list])));
          }
        }
      } catch {
        // Usa lista padrão
      }
    };
    fetchCities();
    return () => { isMounted = false; };
  }, []);

  // Validação dos horários iniciais
  const timeValidation = useMemo(() => {
    if (!selectedDate) return { isValid: false, message: 'Selecione uma data para a consulta.' };
    if (!horaInicial || !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(horaInicial)) {
      return { isValid: false, message: 'Informe um horário inicial válido no formato HH:mm.' };
    }
    if (!horaFinal || !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(horaFinal)) {
      return { isValid: false, message: 'Informe um horário final válido no formato HH:mm.' };
    }

    const [hIni, mIni] = horaInicial.split(':').map(Number);
    const [hFim, mFim] = horaFinal.split(':').map(Number);
    const minutosIni = hIni * 60 + mIni;
    const minutosFim = hFim * 60 + mFim;

    if (minutosFim <= minutosIni) {
      return { isValid: false, message: 'O horário final deve ser estritamente maior que o horário inicial.' };
    }

    return { isValid: true, message: '' };
  }, [selectedDate, horaInicial, horaFinal]);

  // Formatação visual da data selecionada
  const formattedDateDisplay = useMemo(() => {
    if (!selectedDate) {
      return { dateFormatted: 'Selecione a data', weekday: 'Clique para escolher' };
    }
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const year = selectedDate.getFullYear();
    const weekday = selectedDate.toLocaleDateString('pt-BR', { weekday: 'long' });
    return {
      dateFormatted: `${day}/${month}/${year}`,
      weekday: weekday.charAt(0).toUpperCase() + weekday.slice(1)
    };
  }, [selectedDate]);

  // 1. Etapa Inicial: Clicar em "Pesquisar" abre o Modal de Detalhes (Passageiros + Destino)
  const handleOpenSearchDetails = () => {
    if (!timeValidation.isValid) return;
    setIsSearchDetailsModalOpen(true);
  };

  // 2. Execução da Busca Completa
  const executeSearch = async () => {
    if (!searchDestination.trim()) {
      alert('Por favor, informe a cidade de destino.');
      return;
    }
    if (searchPassengerCount < 1) {
      alert('Informe ao menos 1 passageiro.');
      return;
    }

    setIsSearchDetailsModalOpen(false);
    setIsLoading(true);

    try {
      const year = selectedDate.getFullYear();
      const month = selectedDate.getMonth();
      const day = selectedDate.getDate();

      const [hIni, mIni] = horaInicial.split(':').map(Number);
      const [hFim, mFim] = horaFinal.split(':').map(Number);

      const startDateTimeLocal = new Date(year, month, day, hIni, mIni, 0, 0);
      const endDateTimeLocal = new Date(year, month, day, hFim, mFim, 0, 0);

      const queryStartIso = startDateTimeLocal.toISOString();
      const queryEndIso = endDateTimeLocal.toISOString();
      const consultaStartMs = startDateTimeLocal.getTime();
      const consultaEndMs = endDateTimeLocal.getTime();

      // Busca veículos operacionais, setores, pessoas e agendamentos conflitantes no período
      const [
        { data: rawVehicles, error: vErr },
        { data: sectorsData },
        { data: personsData },
        { data: schedulesData, error: sErr }
      ] = await Promise.all([
        supabase
          .from('vehicles')
          .select('id, model, brand, plate, type, vehicle_category, passenger_capacity, year, color, status, available_for_scheduling, sector_id')
          .order('plate', { ascending: true }),
        supabase
          .from('sectors')
          .select('id, name'),
        supabase
          .from('persons')
          .select('id, name'),
        supabase
          .from('vehicle_schedules')
          .select('id, protocol, vehicle_id, driver_id, requester_person_id, requester_id, destination, service_sector_id, purpose, departure_date_time, return_date_time, status, passengers, patient_count, companion_count')
          .not('status', 'in', '("cancelado","rejeitado")')
          .lt('departure_date_time', queryEndIso)
          .gt('return_date_time', queryStartIso)
      ]);

      if (vErr) throw vErr;
      if (sErr) throw sErr;

      // Mapas auxiliares para resolução rápida de nomes
      const sectorMap = new Map<string, string>();
      [...(sectorsData || []), ...availableSectors].forEach((sec: any) => {
        if (sec.id && sec.name) {
          sectorMap.set(sec.id, sec.name);
          sectorMap.set(normalizeSectorText(sec.id), sec.name);
        }
      });

      const personMap = new Map<string, string>();
      [...(personsData || []), ...propPersons].forEach((p: any) => {
        if (p.id && p.name) personMap.set(p.id, p.name);
      });

      // Filtra apenas veículos operacionais e aptos para agendamento
      const activeVehicles = (rawVehicles || []).filter((v: any) => {
        const isOperacional = !v.status || v.status.toLowerCase() === 'operacional' || v.status.toLowerCase() === 'ativo';
        const isDisponivelGeral = v.available_for_scheduling !== 'Não' && v.available_for_scheduling !== 'nao';
        return isOperacional && isDisponivelGeral;
      });

      // Agrupa agendamentos válidos e conflitantes por veículo
      const schedulesByVehicle = new Map<string, any[]>();
      (schedulesData || []).forEach((s: any) => {
        if (!s.vehicle_id || !s.departure_date_time || !s.return_date_time) return;
        const statusLower = (s.status || '').toLowerCase().trim();
        if (statusLower === 'cancelado' || statusLower === 'rejeitado') return;

        const schedStartMs = new Date(s.departure_date_time).getTime();
        const schedEndMs = new Date(s.return_date_time).getTime();
        const hasOverlap = (consultaStartMs < schedEndMs) && (consultaEndMs > schedStartMs);

        if (hasOverlap) {
          const list = schedulesByVehicle.get(s.vehicle_id) || [];
          list.push(s);
          schedulesByVehicle.set(s.vehicle_id, list);
        }
      });

      const targetDestNorm = normalizeCity(searchDestination);
      const computedResults: ResultadoConsultaItem[] = [];

      // Avalia cada veículo da frota
      activeVehicles.forEach((v: any) => {
        const vehicleCap = Number(v.passenger_capacity) || 4;
        const vehicleSchedules = schedulesByVehicle.get(v.id) || [];

        // CASO A: Veículo Totalmente Livre
        if (vehicleSchedules.length === 0) {
          if (vehicleCap >= searchPassengerCount) {
            computedResults.push({
              type: 'livre',
              id: v.id,
              model: v.model,
              brand: v.brand,
              plate: v.plate,
              vehicleType: v.type,
              vehicleCategory: v.vehicle_category,
              passengerCapacity: vehicleCap,
              year: v.year,
              color: v.color,
              sectorId: v.sector_id,
              sectorName: sectorMap.get(v.sector_id) || sectorMap.get(normalizeSectorText(v.sector_id)) || 'Geral'
            });
          }
          return;
        }

        // CASO B: Veículo com Viagem Existente -> Verificar compatibilidade de Destino e Vagas
        vehicleSchedules.forEach((sched: any) => {
          const schedDestNorm = normalizeCity(sched.destination);
          const isDestinationMatch = schedDestNorm === targetDestNorm;

          if (isDestinationMatch) {
            // Calcula ocupação atual
            let occupiedSeats = 0;
            if (Array.isArray(sched.passengers) && sched.passengers.length > 0) {
              occupiedSeats = sched.passengers.length;
            } else {
              occupiedSeats = (Number(sched.patient_count) || 0) + (Number(sched.companion_count) || 0);
              if (occupiedSeats === 0) occupiedSeats = 1; // Ao menos o passageiro/solicitante da viagem
            }

            const remainingSeats = Math.max(0, vehicleCap - occupiedSeats);

            // Se houver vagas suficientes para os novos passageiros solicitados
            if (remainingSeats >= searchPassengerCount) {
              computedResults.push({
                type: 'viagem_existente',
                id: `${v.id}_${sched.id}`,
                scheduleId: sched.id,
                protocol: sched.protocol || 'OS-S/N',
                vehicleId: v.id,
                vehicleModel: v.model,
                vehicleBrand: v.brand,
                vehiclePlate: v.plate,
                vehicleCategory: v.vehicle_category || v.type,
                vehicleColor: v.color,
                driverId: sched.driver_id,
                driverName: personMap.get(sched.driver_id) || 'Motorista a definir',
                serviceSectorId: sched.service_sector_id,
                serviceSectorName: sectorMap.get(sched.service_sector_id) || 'Secretaria Geral',
                departureDateTime: sched.departure_date_time,
                returnDateTime: sched.return_date_time,
                destination: sched.destination,
                purpose: sched.purpose || 'Viagem Oficial',
                totalCapacity: vehicleCap,
                occupiedSeats,
                remainingSeats,
                confirmedPassengers: Array.isArray(sched.passengers) ? sched.passengers : []
              });
            }
          }
        });
      });

      setResultItems(computedResults);
      setLastSearchParams({
        dateStr: formattedDateDisplay.dateFormatted,
        startTime: horaInicial,
        endTime: horaFinal,
        passengers: searchPassengerCount,
        destination: searchDestination.trim().toUpperCase()
      });
      setHasSearched(true);
      setActiveFilterTab('todos');
    } catch (err: any) {
      console.error('[ConsultarVeiculo] Erro ao consultar veículos:', err);
      alert('Erro ao realizar consulta de veículos: ' + (err.message || 'Erro de conexão'));
    } finally {
      setIsLoading(false);
    }
  };

  // Filtros de Setor e Tipo de Resultado
  const filteredResults = useMemo(() => {
    let list = resultItems;

    // Filtro por Setor
    if (selectedSectorId && selectedSectorId !== 'TODOS') {
      const targetNorm = normalizeSectorText(selectedSectorId);
      list = list.filter((item) => {
        if (item.type === 'livre') {
          if (item.sectorId === selectedSectorId) return true;
          if (normalizeSectorText(item.sectorName) === targetNorm) return true;
          return false;
        } else {
          if (item.serviceSectorId === selectedSectorId) return true;
          if (normalizeSectorText(item.serviceSectorName) === targetNorm) return true;
          return false;
        }
      });
    }

    // Filtro por Aba de Tipo
    if (activeFilterTab === 'livres') {
      list = list.filter((item) => item.type === 'livre');
    } else if (activeFilterTab === 'viagens') {
      list = list.filter((item) => item.type === 'viagem_existente');
    }

    return list;
  }, [resultItems, selectedSectorId, activeFilterTab]);

  const countLivres = useMemo(() => resultItems.filter(r => r.type === 'livre').length, [resultItems]);
  const countViagens = useMemo(() => resultItems.filter(r => r.type === 'viagem_existente').length, [resultItems]);

  // Abertura do modal de adicionar passageiros à viagem existente
  const handleOpenInclusionModal = (item: ViagemExistenteItem) => {
    setSelectedTripForInclusion(item);
    // Cria os slots de passageiros com base na quantidade solicitada na pesquisa
    const initialSlots: Array<{
      name: string;
      type: 'paciente' | 'acompanhante' | 'passageiro';
      departureLocation: string;
      appointmentLocation: string;
      appointmentTime: string;
    }> = [];

    const initialCount = Math.min(lastSearchParams?.passengers || 1, item.remainingSeats);
    for (let i = 0; i < initialCount; i++) {
      initialSlots.push({
        name: '',
        type: 'paciente',
        departureLocation: 'Residência / Praça Central',
        appointmentLocation: item.destination,
        appointmentTime: ''
      });
    }

    setInclusionPassengers(initialSlots);
    setInclusionSuccessMessage(null);
    setIsInclusionModalOpen(true);
  };

  // Adicionar mais um passageiro no formulário
  const handleAddInclusionPassengerSlot = () => {
    if (!selectedTripForInclusion) return;
    if (inclusionPassengers.length >= selectedTripForInclusion.remainingSeats) {
      alert(`Limite de vagas atingido! Esta viagem possui apenas ${selectedTripForInclusion.remainingSeats} vagas livres.`);
      return;
    }
    setInclusionPassengers(prev => [
      ...prev,
      {
        name: '',
        type: 'passageiro',
        departureLocation: 'Residência / Praça Central',
        appointmentLocation: selectedTripForInclusion.destination,
        appointmentTime: ''
      }
    ]);
  };

  // Remover slot de passageiro
  const handleRemoveInclusionPassengerSlot = (index: number) => {
    if (inclusionPassengers.length <= 1) {
      alert('Informe ao menos um passageiro.');
      return;
    }
    setInclusionPassengers(prev => prev.filter((_, i) => i !== index));
  };

  // Submissão da Solicitação de Inclusão de Passageiros
  const handleSubmitInclusion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTripForInclusion) return;

    // Valida se todos os passageiros têm nome preenchido
    const emptyNames = inclusionPassengers.some(p => !p.name.trim());
    if (emptyNames) {
      alert('Por favor, preencha o nome de todos os passageiros a serem adicionados.');
      return;
    }

    setIsInclusionSubmitting(true);
    try {
      const protocol = `INC-${Date.now().toString().slice(-6)}`;

      const formattedPassengers: CrewMember[] = inclusionPassengers.map(p => ({
        name: p.name.trim().toUpperCase(),
        type: p.type,
        departureLocation: p.departureLocation.trim() || 'Residência',
        appointmentLocation: p.appointmentLocation.trim() || selectedTripForInclusion.destination,
        appointmentTime: p.appointmentTime.trim() || 'A definir'
      }));

      // 1. Cria a solicitação de inclusão em vehicle_schedules com status 'pendente'
      const { error: insertErr } = await supabase
        .from('vehicle_schedules')
        .insert([{
          protocol,
          vehicle_id: selectedTripForInclusion.vehicleId,
          driver_id: selectedTripForInclusion.driverId || null,
          requester_person_id: currentUserId || null,
          requester_id: currentUserId || null,
          destination: selectedTripForInclusion.destination,
          service_sector_id: selectedTripForInclusion.serviceSectorId || null,
          purpose: `[INCLUSÃO DE PASSAGEIROS] Vagas solicitadas na viagem ${selectedTripForInclusion.protocol} (${selectedTripForInclusion.vehicleModel} - ${selectedTripForInclusion.vehiclePlate})`,
          departure_date_time: selectedTripForInclusion.departureDateTime,
          return_date_time: selectedTripForInclusion.returnDateTime,
          status: 'pendente',
          passengers: formattedPassengers,
          patient_count: formattedPassengers.filter(p => p.type === 'paciente').length,
          companion_count: formattedPassengers.filter(p => p.type === 'acompanhante').length
        }]);

      if (insertErr) throw insertErr;

      // 2. Notifica gestores de frotas sobre a solicitação para aprovação
      try {
        const { data: managers } = await supabase
          .from('profiles')
          .select('id')
          .contains('permissions', ['parent_frotas']);

        if (managers) {
          for (const manager of managers) {
            await notificationService.createNotification({
              user_id: manager.id,
              title: 'Solicitação de Inclusão de Passageiros',
              message: `Pedido ${protocol} para inclusão de ${formattedPassengers.length} passageiro(s) na viagem ${selectedTripForInclusion.protocol} (${selectedTripForInclusion.destination}).`,
              type: 'info',
              link: '/AgendamentoVeiculos/Aprovacoes'
            });
          }
        }
      } catch (notifErr) {
        console.warn('Erro ao notificar gestores:', notifErr);
      }

      setInclusionSuccessMessage(`Solicitação ${protocol} enviada com sucesso! As ${formattedPassengers.length} vaga(s) foram reservadas e encaminhadas para aprovação.`);

      // Atualiza o resultado localmente para refletir a reserva imediata das vagas
      setResultItems(prev => prev.map(item => {
        if (item.type === 'viagem_existente' && item.scheduleId === selectedTripForInclusion.scheduleId) {
          const newOccupied = item.occupiedSeats + formattedPassengers.length;
          return {
            ...item,
            occupiedSeats: newOccupied,
            remainingSeats: Math.max(0, item.totalCapacity - newOccupied)
          };
        }
        return item;
      }));

    } catch (err: any) {
      console.error('[InclusãoPassageiros] Erro ao submeter:', err);
      alert('Erro ao enviar solicitação de inclusão: ' + (err.message || 'Erro desconhecido'));
    } finally {
      setIsInclusionSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto h-full bg-slate-50">
      {/* Barra de Navegação Superior */}
      <div className="bg-white border-b border-slate-200/80 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 shadow-sm sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack} 
            className="w-11 h-11 bg-white rounded-2xl flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200/80 shadow-sm transition-all active:scale-95 group cursor-pointer"
            title="Voltar ao Menu Principal"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-0.5 transition-transform" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-violet-100 text-violet-700">
                <Search className="w-5 h-5" />
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tight leading-none">
                Consultar Veículo
              </h2>
            </div>
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-1 ml-0.5">
              Consulta de veículos livres e compartilhamento de viagens com vagas disponíveis
            </p>
          </div>
        </div>

        {/* Badge Informativo */}
        <div className="hidden lg:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-xs font-semibold">
          <Info className="w-4 h-4 text-violet-600" />
          <span>Verificação em tempo real por Destino, Período e Vagas</span>
        </div>
      </div>

      {/* Conteúdo Central */}
      <div className="p-4 md:p-8 max-w-6xl w-full mx-auto space-y-6">
        {/* Card do Formulário de Consulta */}
        <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-violet-500/20">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base md:text-lg font-black text-slate-800 tracking-tight">
                Definir Período da Consulta
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                Informe a data, o intervalo de horário e os dados da viagem desejada
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* CAMPO 1: DATA */}
            <div className="flex flex-col space-y-2">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <CalendarIcon className="w-4 h-4 text-violet-600" />
                1. Data da Viagem
              </label>

              <button
                type="button"
                onClick={() => setIsDatePickerOpen(true)}
                className="w-full text-left px-4 py-3 bg-slate-50 hover:bg-violet-50/60 border border-slate-200 hover:border-violet-300 rounded-2xl transition-all group flex items-center justify-between shadow-inner h-[50px] cursor-pointer"
              >
                <div>
                  <div className="text-sm font-black text-slate-800 group-hover:text-violet-900 tracking-tight">
                    {formattedDateDisplay.dateFormatted}
                  </div>
                  <div className="text-[10px] font-bold text-violet-600 uppercase tracking-wider">
                    {formattedDateDisplay.weekday}
                  </div>
                </div>
                <div className="p-1.5 bg-white rounded-xl shadow-xs text-slate-400 group-hover:text-violet-600 transition-colors">
                  <CalendarDays className="w-4 h-4" />
                </div>
              </button>
              <span className="text-[10px] text-slate-400 font-semibold">Data da viagem</span>
            </div>

            {/* CAMPO 2: HORA INICIAL */}
            <div className="flex flex-col space-y-2">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-indigo-600" />
                2. Hora Inicial
              </label>

              <div className="relative">
                <input
                  type="time"
                  value={horaInicial}
                  onChange={(e) => setHoraInicial(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-2xl text-sm font-black text-slate-800 tracking-wider shadow-inner outline-none transition-all h-[50px]"
                />
              </div>
              <span className="text-[10px] text-slate-400 font-semibold">Formato 24 horas (HH:mm)</span>
            </div>

            {/* CAMPO 3: HORA FINAL */}
            <div className="flex flex-col space-y-2">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-purple-600" />
                3. Hora Final
              </label>

              <div className="relative">
                <input
                  type="time"
                  value={horaFinal}
                  onChange={(e) => setHoraFinal(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-purple-500 rounded-2xl text-sm font-black text-slate-800 tracking-wider shadow-inner outline-none transition-all h-[50px]"
                />
              </div>
              <span className="text-[10px] text-slate-400 font-semibold">Formato 24 horas (HH:mm)</span>
            </div>

            {/* CAMPO 4: FILTRAR POR SETOR */}
            <div className="flex flex-col space-y-2">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-emerald-600" />
                4. Setor / Lotação
              </label>

              <div className="relative">
                <select
                  value={selectedSectorId}
                  onChange={(e) => setSelectedSectorId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-emerald-500 rounded-2xl text-xs font-black text-slate-800 tracking-wider shadow-inner outline-none transition-all h-[50px] uppercase cursor-pointer"
                >
                  <option value="">TODOS OS SETORES</option>
                  {availableSectors.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <span className="text-[10px] text-slate-400 font-semibold">Filtre por setor específico ou geral</span>
            </div>
          </div>

          {/* Mensagem de validação inline */}
          {!timeValidation.isValid && timeValidation.message && (
            <div className="mt-4 p-3 bg-rose-50 border border-rose-200/80 rounded-2xl flex items-center gap-2.5 text-rose-700 text-xs font-semibold animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{timeValidation.message}</span>
            </div>
          )}

          {/* BOTÃO DE PESQUISA */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-400 font-medium hidden sm:block">
              Ao pesquisar, solicitaremos a quantidade de passageiros e o destino para verificar vagas disponíveis.
            </div>

            <button
              type="button"
              disabled={!timeValidation.isValid || isLoading}
              onClick={handleOpenSearchDetails}
              className={`w-full sm:w-auto px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2.5 shadow-lg transition-all active:scale-95 ${
                timeValidation.isValid && !isLoading
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-violet-500/25 hover:-translate-y-0.5 cursor-pointer'
                  : 'bg-slate-200 text-slate-400 shadow-none cursor-not-allowed'
              }`}
            >
              <Search className="w-4 h-4" />
              <span>Pesquisar Veículos Disponíveis</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* ÁREA DE RESULTADOS */}
        {/* ========================================================================= */}
        {hasSearched && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-3 duration-300">
            {/* Header de Resumo da Pesquisa com Filtros em Abas */}
            <div className="bg-white rounded-3xl p-5 md:p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white flex items-center justify-center font-black text-lg shadow-md shadow-violet-500/20 shrink-0">
                    {filteredResults.length}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-base md:text-lg font-black text-slate-900 tracking-tight">
                        {filteredResults.length === 1 ? '1 opção disponível' : `${filteredResults.length} opções disponíveis`}
                      </h4>
                      {lastSearchParams && (
                        <span className="px-2.5 py-0.5 rounded-lg bg-violet-50 text-violet-700 border border-violet-200 text-[11px] font-black uppercase tracking-wider">
                          Destino: {lastSearchParams.destination}
                        </span>
                      )}
                      {lastSearchParams && (
                        <span className="px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-black">
                          {lastSearchParams.passengers} {lastSearchParams.passengers === 1 ? 'Passageiro' : 'Passageiros'}
                        </span>
                      )}
                    </div>
                    {lastSearchParams && (
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        Para <span className="font-bold text-slate-700">{lastSearchParams.dateStr}</span> das <span className="font-bold text-slate-700">{lastSearchParams.startTime}</span> às <span className="font-bold text-slate-700">{lastSearchParams.endTime}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Filtros em Pílulas */}
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200/70 overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setActiveFilterTab('todos')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap cursor-pointer ${
                      activeFilterTab === 'todos' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Todos ({resultItems.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFilterTab('livres')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                      activeFilterTab === 'livres' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-emerald-700'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Livres ({countLivres})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFilterTab('viagens')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
                      activeFilterTab === 'viagens' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:text-amber-700'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span>Viagens com Vagas ({countViagens})</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Caso 1: Nenhum resultado */}
            {filteredResults.length === 0 ? (
              <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 shadow-xs max-w-lg mx-auto space-y-3">
                <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-600 border border-amber-200/80 flex items-center justify-center mx-auto shadow-sm">
                  <Car className="w-8 h-8" />
                </div>
                <h4 className="text-lg font-black text-slate-800 tracking-tight">
                  Nenhum veículo livre ou viagem com vagas compatíveis.
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Não encontramos veículos disponíveis ou viagens agendadas para <strong>{lastSearchParams?.destination}</strong> no horário selecionado com capacidade para {lastSearchParams?.passengers} passageiro(s).
                </p>
                <button
                  type="button"
                  onClick={() => setIsSearchDetailsModalOpen(true)}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                >
                  Ajustar Parâmetros da Busca
                </button>
              </div>
            ) : (
              /* Grade de Cards dos Resultados */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredResults.map((item) => {
                  // CARD TIPO A: VEÍCULO LIVRE
                  if (item.type === 'livre') {
                    return (
                      <div
                        key={item.id}
                        className="bg-white rounded-3xl p-5 md:p-6 border border-slate-200 hover:border-emerald-300 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group relative overflow-hidden"
                      >
                        {/* Faixa Superior Verde */}
                        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 to-teal-500" />

                        <div>
                          {/* Topo do Card: Placa e Indicador VEÍCULO LIVRE */}
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-900 text-white rounded-xl font-mono font-black text-xs tracking-wider shadow-xs">
                              <span className="text-[9px] text-sky-400 font-sans font-black">BR</span>
                              <span>{item.plate}</span>
                            </div>

                            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black uppercase tracking-wider rounded-xl shadow-xs">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              VEÍCULO LIVRE
                            </span>
                          </div>

                          {/* Modelo e Marca */}
                          <h4 className="text-lg font-black text-slate-900 tracking-tight uppercase group-hover:text-emerald-700 transition-colors">
                            {item.model}
                          </h4>
                          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                            {item.brand || 'Marca não informada'}
                          </p>

                          {/* Informações do Veículo */}
                          <div className="space-y-2 text-xs border-t border-slate-100 pt-3 text-slate-600 font-medium">
                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 flex items-center gap-1">
                                <Tag className="w-3.5 h-3.5 text-slate-400" /> Categoria:
                              </span>
                              <span className="font-bold text-slate-700 uppercase">
                                {item.vehicleCategory || item.vehicleType || 'Geral'}
                              </span>
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 flex items-center gap-1">
                                <Users className="w-3.5 h-3.5 text-slate-400" /> Capacidade Total:
                              </span>
                              <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                                {item.passengerCapacity} passageiros
                              </span>
                            </div>

                            <div className="flex items-center justify-between">
                              <span className="text-slate-400 flex items-center gap-1">
                                <Building2 className="w-3.5 h-3.5 text-slate-400" /> Setor do Veículo:
                              </span>
                              <span className="font-bold text-slate-700 uppercase truncate max-w-[140px]" title={item.sectorName}>
                                {item.sectorName || 'Geral'}
                              </span>
                            </div>

                            {item.color && (
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400">Cor:</span>
                                <span className="font-bold text-slate-700 uppercase">{item.color}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Botão de Agendar Veículo Livre */}
                        <div className="mt-5 pt-3 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => {
                              if (lastSearchParams && onSelectVehicleToSchedule) {
                                onSelectVehicleToSchedule(
                                  item.id,
                                  lastSearchParams.dateStr,
                                  lastSearchParams.startTime,
                                  lastSearchParams.endTime,
                                  lastSearchParams.destination,
                                  lastSearchParams.passengers
                                );
                              }
                            }}
                            className="w-full py-2.5 px-4 bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-98 shadow-xs cursor-pointer"
                          >
                            <Sparkles className="w-4 h-4" />
                            <span>Agendar este Veículo</span>
                          </button>
                        </div>
                      </div>
                    );
                  }

                  // CARD TIPO B: VIAGEM EXISTENTE COM VAGAS DISPONÍVEIS
                  return (
                    <div
                      key={item.id}
                      className="bg-white rounded-3xl p-5 md:p-6 border-2 border-amber-300 hover:border-amber-400 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group relative overflow-hidden bg-gradient-to-b from-amber-50/20 via-white to-white"
                    >
                      {/* Faixa Superior Âmbar/Laranja */}
                      <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600" />

                      <div>
                        {/* Topo do Card: Placa e Indicador VIAGEM EXISTENTE */}
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-900 text-white rounded-xl font-mono font-black text-xs tracking-wider shadow-xs">
                            <span className="text-[9px] text-amber-400 font-sans font-black">BR</span>
                            <span>{item.vehiclePlate}</span>
                          </div>

                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-black uppercase tracking-wider rounded-xl shadow-xs">
                            <Users className="w-3.5 h-3.5 text-amber-700" />
                            VIAGEM EXISTENTE — VAGAS
                          </span>
                        </div>

                        {/* Modelo do Veículo e Protocolo */}
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="text-lg font-black text-slate-900 tracking-tight uppercase group-hover:text-amber-800 transition-colors">
                              {item.vehicleModel}
                            </h4>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                              {item.vehicleBrand} • {item.vehicleCategory || 'Veículo'}
                            </p>
                          </div>
                          <span className="text-[10px] font-mono font-bold text-slate-400">
                            {item.protocol}
                          </span>
                        </div>

                        {/* Destaque das Vagas Disponíveis */}
                        <div className="p-3 bg-amber-50/80 rounded-2xl border border-amber-200/80 mb-3 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 block">
                              Vagas Restantes
                            </span>
                            <span className="text-base font-black text-amber-950">
                              {item.remainingSeats} {item.remainingSeats === 1 ? 'vaga livre' : 'vagas livres'}
                            </span>
                          </div>
                          <div className="text-right text-[11px] font-semibold text-amber-800/80">
                            <span>Ocupação: {item.occupiedSeats}/{item.totalCapacity}</span>
                          </div>
                        </div>

                        {/* Detalhes da Viagem Existente */}
                        <div className="space-y-2 text-xs border-t border-slate-100 pt-3 text-slate-600 font-medium">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-slate-400 flex items-center gap-1 shrink-0">
                              <MapPin className="w-3.5 h-3.5 text-rose-500" /> Destino:
                            </span>
                            <span className="font-black text-slate-900 uppercase text-right">
                              {item.destination}
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5 text-slate-400" /> Horário:
                            </span>
                            <span className="font-bold text-slate-700">
                              {new Date(item.departureDateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} até {new Date(item.returnDateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 flex items-center gap-1">
                              <User className="w-3.5 h-3.5 text-slate-400" /> Motorista:
                            </span>
                            <span className="font-bold text-slate-700 truncate max-w-[140px]" title={item.driverName}>
                              {item.driverName || 'A definir'}
                            </span>
                          </div>

                          {item.confirmedPassengers.length > 0 && (
                            <div className="pt-1">
                              <span className="text-[10px] font-black uppercase text-slate-400 block mb-1">
                                Passageiros Confirmados ({item.confirmedPassengers.length}):
                              </span>
                              <div className="flex flex-wrap gap-1 max-h-16 overflow-y-auto custom-scrollbar">
                                {item.confirmedPassengers.map((p, pIdx) => (
                                  <span key={pIdx} className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-semibold truncate max-w-[150px]">
                                    {p.name} {p.type ? `(${p.type})` : ''}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Botão de Ação: Adicionar Passageiros à Viagem */}
                      <div className="mt-5 pt-3 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => handleOpenInclusionModal(item)}
                          className="w-full py-2.5 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-98 shadow-md shadow-orange-500/20 cursor-pointer"
                        >
                          <UserPlus className="w-4 h-4" />
                          <span>Adicionar passageiros à viagem</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL 1: DEFINIR PASSAGEIROS E DESTINO (ETAPA 2 DA PESQUISA) */}
      {/* ========================================================================= */}
      {isSearchDetailsModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-violet-50/80 via-white to-purple-50/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-violet-500/25">
                  <Compass className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight uppercase">
                    Detalhes da Pesquisa
                  </h3>
                  <p className="text-xs text-slate-400 font-semibold">
                    Informe os passageiros e o destino para verificar vagas
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSearchDetailsModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Formulário */}
            <div className="p-6 space-y-5">
              {/* Quantidade de Passageiros */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span>Quantidade de Passageiros *</span>
                  <span className="text-[10px] text-slate-400 font-semibold">vagas necessárias</span>
                </label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSearchPassengerCount(prev => Math.max(1, prev - 1))}
                    className="w-12 h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-lg flex items-center justify-center transition-all cursor-pointer"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={searchPassengerCount}
                    onChange={(e) => setSearchPassengerCount(Math.max(1, Number(e.target.value) || 1))}
                    className="flex-1 h-12 text-center text-xl font-black text-slate-900 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 outline-none transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setSearchPassengerCount(prev => prev + 1)}
                    className="w-12 h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-lg flex items-center justify-center transition-all cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Destino da Viagem */}
              <div className="space-y-2">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span>Cidade de Destino *</span>
                  <span className="text-[10px] text-slate-400 font-semibold">onde será a viagem</span>
                </label>
                <input
                  type="text"
                  list="destination-cities-list"
                  placeholder="Ex: BELO HORIZONTE - MG, IPATINGA - MG..."
                  value={searchDestination}
                  onChange={(e) => setSearchDestination(e.target.value.toUpperCase())}
                  className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 rounded-2xl text-sm font-bold text-slate-900 uppercase placeholder:normal-case placeholder:font-normal placeholder:text-slate-400 outline-none transition-all"
                />
                <datalist id="destination-cities-list">
                  {availableCities.map((city, idx) => (
                    <option key={idx} value={city} />
                  ))}
                </datalist>
              </div>

              {/* Sugestões Rápidas de Destino */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                  Destinos Mais Frequentes:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {['BELO HORIZONTE - MG', 'IPATINGA - MG', 'JOÃO MONLEVADE - MG', 'PONTE NOVA - MG', 'ITABIRA - MG'].map((city, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSearchDestination(city)}
                      className={`text-[11px] px-2.5 py-1 rounded-xl font-bold uppercase transition-all cursor-pointer ${
                        searchDestination === city
                          ? 'bg-violet-600 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                      }`}
                    >
                      {city.replace(' - MG', '')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ações */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSearchDetailsModalOpen(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={executeSearch}
                  className="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md shadow-violet-500/25 flex items-center gap-2 active:scale-98 transition-all cursor-pointer"
                >
                  <Search className="w-4 h-4" />
                  <span>Realizar Consulta</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: ADICIONAR PASSAGEIROS À VIAGEM EXISTENTE (COMPARTILHAMENTO) */}
      {/* ========================================================================= */}
      {isInclusionModalOpen && selectedTripForInclusion && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 md:p-6 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl border border-slate-200 max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 md:px-8 md:py-5 border-b border-slate-100 bg-gradient-to-r from-amber-50/80 via-white to-orange-50/40 flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-md shadow-orange-500/25 shrink-0">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight uppercase">
                    Adicionar Passageiros à Viagem
                  </h3>
                  <p className="text-xs text-slate-400 font-semibold">
                    Protocolo: <span className="font-mono text-slate-700 font-bold">{selectedTripForInclusion.protocol}</span> • Destino: <span className="text-amber-700 font-bold">{selectedTripForInclusion.destination}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsInclusionModalOpen(false)}
                className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo do Formulário */}
            <form onSubmit={handleSubmitInclusion} className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 space-y-6">
              {/* Card Resumo da Viagem Existente */}
              <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase text-amber-950">
                    {selectedTripForInclusion.vehicleModel} ({selectedTripForInclusion.vehiclePlate})
                  </span>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 bg-amber-200/80 text-amber-900 rounded-lg">
                    {selectedTripForInclusion.remainingSeats} vagas restantes
                  </span>
                </div>
                <div className="text-xs text-amber-900/80 font-medium flex items-center gap-4 flex-wrap">
                  <span>Horário: <strong>{new Date(selectedTripForInclusion.departureDateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} às {new Date(selectedTripForInclusion.returnDateTime).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</strong></span>
                  <span>Motorista: <strong>{selectedTripForInclusion.driverName || 'A definir'}</strong></span>
                </div>
              </div>

              {/* Mensagem de Sucesso (se já enviado) */}
              {inclusionSuccessMessage ? (
                <div className="p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h4 className="text-base font-black text-emerald-900">
                    Solicitação Encaminhada!
                  </h4>
                  <p className="text-xs text-emerald-700 font-medium">
                    {inclusionSuccessMessage}
                  </p>
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsInclusionModalOpen(false)}
                      className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs uppercase tracking-wider cursor-pointer"
                    >
                      Concluir
                    </button>
                    {onNavigate && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsInclusionModalOpen(false);
                          onNavigate('/AgendamentoVeiculos/Aprovacoes');
                        }}
                        className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs uppercase tracking-wider shadow-sm cursor-pointer"
                      >
                        Ver em Aprovações
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                /* Lista de Passageiros para Preenchimento */
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-amber-600" />
                      <span>Passageiros a Adicionar ({inclusionPassengers.length})</span>
                    </h4>
                    {inclusionPassengers.length < selectedTripForInclusion.remainingSeats && (
                      <button
                        type="button"
                        onClick={handleAddInclusionPassengerSlot}
                        className="px-3 py-1 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-800 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Adicionar Outro</span>
                      </button>
                    )}
                  </div>

                  {inclusionPassengers.map((passenger, pIdx) => (
                    <div
                      key={pIdx}
                      className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 relative group"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-600">
                          Passageiro #{pIdx + 1}
                        </span>
                        {inclusionPassengers.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveInclusionPassengerSlot(pIdx)}
                            className="text-rose-500 hover:text-rose-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
                            title="Remover passageiro"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span className="text-[10px]">Remover</span>
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {/* Nome Completo */}
                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-[10px] font-black uppercase text-slate-600">
                            Nome Completo *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="Nome do passageiro ou paciente..."
                            value={passenger.name}
                            onChange={(e) => {
                              const val = e.target.value;
                              setInclusionPassengers(prev => prev.map((p, i) => i === pIdx ? { ...p, name: val } : p));
                            }}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 outline-none uppercase"
                          />
                        </div>

                        {/* Tipo de Passageiro */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-slate-600">
                            Tipo de Integrante
                          </label>
                          <select
                            value={passenger.type}
                            onChange={(e) => {
                              const val = e.target.value as any;
                              setInclusionPassengers(prev => prev.map((p, i) => i === pIdx ? { ...p, type: val } : p));
                            }}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:border-amber-500 outline-none cursor-pointer"
                          >
                            <option value="paciente">Paciente</option>
                            <option value="acompanhante">Acompanhante</option>
                            <option value="passageiro">Passageiro / Servidor</option>
                          </select>
                        </div>

                        {/* Local de Embarque */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-slate-600">
                            Local de Embarque
                          </label>
                          <input
                            type="text"
                            placeholder="Ex: Residência, Posto de Saúde..."
                            value={passenger.departureLocation}
                            onChange={(e) => {
                              const val = e.target.value;
                              setInclusionPassengers(prev => prev.map((p, i) => i === pIdx ? { ...p, departureLocation: val } : p));
                            }}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:border-amber-500 outline-none"
                          />
                        </div>

                        {/* Local de Desembarque / Atendimento */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-slate-600">
                            Local de Destino / Atendimento
                          </label>
                          <input
                            type="text"
                            placeholder="Ex: Hospital das Clínicas, Consulta..."
                            value={passenger.appointmentLocation}
                            onChange={(e) => {
                              const val = e.target.value;
                              setInclusionPassengers(prev => prev.map((p, i) => i === pIdx ? { ...p, appointmentLocation: val } : p));
                            }}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:border-amber-500 outline-none"
                          />
                        </div>

                        {/* Horário do Atendimento */}
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-slate-600">
                            Horário do Compromisso (Opcional)
                          </label>
                          <input
                            type="text"
                            placeholder="Ex: 09:30"
                            value={passenger.appointmentTime}
                            onChange={(e) => {
                              const val = e.target.value;
                              setInclusionPassengers(prev => prev.map((p, i) => i === pIdx ? { ...p, appointmentTime: val } : p));
                            }}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:border-amber-500 outline-none text-center"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Botões do Rodapé */}
              {!inclusionSuccessMessage && (
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsInclusionModalOpen(false)}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isInclusionSubmitting}
                    className="px-7 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-md shadow-orange-500/25 flex items-center gap-2 active:scale-98 transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isInclusionSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    <span>{isInclusionSubmitting ? 'Enviando Solicitação...' : 'Enviar Solicitação de Inclusão'}</span>
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Date Picker Modal Personalizado */}
      <DateTimePickerModal
        isOpen={isDatePickerOpen}
        onClose={() => setIsDatePickerOpen(false)}
        title="Selecione a Data da Consulta"
        initialDate={selectedDate}
        mode="date"
        onSelect={(date) => {
          setSelectedDate(date);
          setIsDatePickerOpen(false);
        }}
      />
    </div>
  );
};
