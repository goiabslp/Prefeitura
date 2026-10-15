import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  ShieldAlert, 
  Search, 
  RotateCcw, 
  Calendar, 
  Clock, 
  Car, 
  User, 
  MapPin, 
  Building2, 
  FileText, 
  Navigation, 
  CheckCircle2, 
  AlertTriangle, 
  Copy, 
  Printer, 
  ExternalLink, 
  RefreshCw,
  Info,
  Layers,
  Sparkles,
  Users,
  Check
} from 'lucide-react';
import { Vehicle, Sector, Person, VehicleSchedule, DiariaEvento } from '../../types';
import { getAllDiariaEventos } from '../../services/diariasEventosService';
import { getSchedules } from '../../services/vehicleSchedulingService';
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FleetFinesProps {
  vehicles: Vehicle[];
  sectors: Sector[];
  persons: Person[];
  onNavigate?: (tab: string, subId?: string) => void;
}

export interface FineMatchResult {
  id: string;
  source: 'diarias' | 'agendamento';
  sourceLabel: 'Diária' | 'Agendamento de Veículo';
  protocol?: string;
  driver: string;             // Motorista
  requester?: string;          // Servidor / Solicitante
  sector: string;             // Setor
  destination: string;        // Destino
  purpose: string;            // Motivo / Finalidade
  departureDateTime: string;  // Data/hora de saída
  returnDateTime: string;     // Data/hora de retorno
  vehicleModel: string;       // Veículo (modelo/marca)
  vehiclePlate: string;       // Placa
  status?: string;
  passengers?: string[];
  rawRecord: any;
}

export const FleetFines: React.FC<FleetFinesProps> = ({
  vehicles,
  sectors,
  persons,
  onNavigate
}) => {
  // Parâmetros de pesquisa
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [fineDate, setFineDate] = useState<string>('');
  const [fineTime, setFineTime] = useState<string>('');

  // Fontes de dados
  const [diarias, setDiarias] = useState<DiariaEvento[]>([]);
  const [schedules, setSchedules] = useState<VehicleSchedule[]>([]);
  const [isLoadingSources, setIsLoadingSources] = useState<boolean>(true);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [results, setResults] = useState<FineMatchResult[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Normalização de placas e strings
  const cleanPlate = useCallback((p?: string) => {
    return (p || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  }, []);

  const normalizeStr = useCallback((str?: string) => {
    if (!str) return '';
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  }, []);

  // 1. Carregar dados reais de /Diarias/Lancamentos e /AgendamentoVeiculos/Historico
  const loadSourcesData = useCallback(async () => {
    setIsLoadingSources(true);
    try {
      const [diariasData, schedulesData] = await Promise.all([
        getAllDiariaEventos().catch(err => {
          console.warn('Erro ao carregar diárias para consulta de multas:', err);
          return [] as DiariaEvento[];
        }),
        getSchedules().catch(err => {
          console.warn('Erro ao carregar agendamentos para consulta de multas:', err);
          return [] as VehicleSchedule[];
        })
      ]);

      setDiarias(diariasData || []);
      setSchedules(schedulesData || []);
    } catch (err) {
      console.error('Falha geral ao sincronizar bases de viagens:', err);
    } finally {
      setIsLoadingSources(false);
    }
  }, []);

  useEffect(() => {
    loadSourcesData();
  }, [loadSourcesData]);

  // 2. Leitura de parâmetros iniciais da URL (ex: /Frota/Multas?veiculo=...&data=...&hora=...)
  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const urlVehicle = searchParams.get('veiculo') || searchParams.get('vehicleId');
      const urlDate = searchParams.get('data') || searchParams.get('date');
      const urlTime = searchParams.get('hora') || searchParams.get('time');

      if (urlVehicle) setSelectedVehicleId(urlVehicle);
      if (urlDate) setFineDate(urlDate);
      if (urlTime) setFineTime(urlTime);
    } catch (e) {
      console.warn('Erro ao ler searchParams da URL:', e);
    }
  }, []);

  // Formatação segura de data/hora para exibição
  const formatDateTimeDisplay = (dtStr?: string) => {
    if (!dtStr) return 'Não informada';
    if (dtStr.startsWith('2099')) return 'Em andamento / Não definida';
    try {
      const d = parseISO(dtStr);
      if (!isValid(d)) {
        const rawDate = new Date(dtStr);
        if (isValid(rawDate)) {
          return format(rawDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
        }
        return dtStr;
      }
      return format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return dtStr;
    }
  };

  // 3. Execução da Consulta Cruzada
  const handleSearch = useCallback(() => {
    if (!selectedVehicleId) {
      alert('Selecione o veículo da ocorrência para iniciar a pesquisa.');
      return;
    }
    if (!fineDate) {
      alert('Informe a data em que ocorreu a infração de trânsito.');
      return;
    }
    if (!fineTime) {
      alert('Informe o horário exato da infração de trânsito.');
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    // Atualizar URL sem recarregar a página (mantendo a rota canônica /Frota/Multas com parâmetros)
    try {
      const params = new URLSearchParams();
      params.set('veiculo', selectedVehicleId);
      params.set('data', fineDate);
      params.set('hora', fineTime);
      const newUrl = `/Frota/Multas?${params.toString()}`;
      window.history.replaceState({}, '', newUrl);
    } catch (e) {
      console.warn('Falha ao atualizar parâmetros na URL:', e);
    }

    const targetVehicle = vehicles.find(v => v.id === selectedVehicleId);
    const targetPlateClean = cleanPlate(targetVehicle?.plate);
    const targetModelNorm = normalizeStr(targetVehicle?.model);
    const targetBrandNorm = normalizeStr(targetVehicle?.brand);

    // Construção do Timestamp da infração com tolerância precisa
    const [hours, minutes] = fineTime.split(':').map(Number);
    const infractionTarget = new Date(`${fineDate}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
    const infractionTimestamp = infractionTarget.getTime();

    const matches: FineMatchResult[] = [];

    // --- FONTE 1: Agendamento de Veículos (/AgendamentoVeiculos/Historico) ---
    schedules.forEach(s => {
      // Ignorar cancelados / rejeitados
      if (s.status === 'cancelado') return;

      // Correspondência do Veículo
      const scheduleVehicle = vehicles.find(v => v.id === s.vehicleId);
      const isVehicleDirectMatch = s.vehicleId === selectedVehicleId;
      const isPlateMatch = targetPlateClean && scheduleVehicle && cleanPlate(scheduleVehicle.plate) === targetPlateClean;

      if (!isVehicleDirectMatch && !isPlateMatch) return;

      // Correspondência do Período (Saída <= Infração <= Retorno)
      try {
        const depDate = parseISO(s.departureDateTime);
        const retDate = parseISO(s.returnDateTime);

        if (!isValid(depDate) || !isValid(retDate)) return;

        const depTime = depDate.getTime();
        const retTime = retDate.getTime();

        if (infractionTimestamp >= depTime && infractionTimestamp <= retTime) {
          const driverPerson = persons.find(p => p.id === s.driverId);
          const requesterPerson = persons.find(p => p.id === s.requesterPersonId);
          const sectorObj = sectors.find(sec => sec.id === s.serviceSectorId);

          const passengerNames = (s.passengers || []).map(p => p.name).filter(Boolean);

          matches.push({
            id: `agendamento_${s.id}`,
            source: 'agendamento',
            sourceLabel: 'Agendamento de Veículo',
            protocol: s.protocol,
            driver: driverPerson ? driverPerson.name : (s.authorizedByName || 'Condutor Não Especificado'),
            requester: requesterPerson ? requesterPerson.name : (s.authorizedByName || s.requesterId || 'Solicitante do Setor'),
            sector: sectorObj ? (sectorObj.full_name || sectorObj.name) : 'Setor Não Informado',
            destination: s.destination || 'Não informado',
            purpose: s.purpose || 'Finalidade não preenchida',
            departureDateTime: s.departureDateTime,
            returnDateTime: s.returnDateTime,
            vehicleModel: targetVehicle ? `${targetVehicle.brand} ${targetVehicle.model}` : 'Veículo da Frota',
            vehiclePlate: targetVehicle?.plate || scheduleVehicle?.plate || 'Não informada',
            status: s.status,
            passengers: passengerNames,
            rawRecord: s
          });
        }
      } catch (e) {
        console.warn('Erro ao processar datas do agendamento:', s.id, e);
      }
    });

    // --- FONTE 2: Diárias (/Diarias/Lancamentos) ---
    diarias.forEach(d => {
      // Ignorar diárias rejeitadas ou canceladas
      if (
        d.status === 'cancelado' || 
        d.status === 'rejeitado_gestor' || 
        d.status === 'rejeitado_administrador'
      ) {
        return;
      }

      // Correspondência do Veículo nas Diárias
      const rawVeiculoStr = typeof d.veiculo === 'string' 
        ? d.veiculo 
        : ((d.veiculo as any)?.plate || (d.veiculo as any)?.model || d.veiculo_outro || '');
      
      const diariaPlateClean = cleanPlate(rawVeiculoStr);
      const diariaVeiculoNorm = normalizeStr(rawVeiculoStr);

      const isDirectIdMatch = d.veiculo === selectedVehicleId;
      const isPlateMatch = targetPlateClean && (diariaPlateClean.includes(targetPlateClean) || targetPlateClean.includes(diariaPlateClean));
      const isModelMatch = targetModelNorm && diariaVeiculoNorm.includes(targetModelNorm);
      const isBrandMatch = targetBrandNorm && diariaVeiculoNorm.includes(targetBrandNorm);

      if (!isDirectIdMatch && !isPlateMatch && !isModelMatch && !isBrandMatch) return;

      // Correspondência do Período
      try {
        const depDate = parseISO(d.data_saida);
        if (!isValid(depDate)) return;

        const depTime = depDate.getTime();
        let retTime: number;

        const isRetornoSentinela = !d.data_retorno || String(d.data_retorno).startsWith('2099');

        if (isRetornoSentinela) {
          // Se a diária não tem data de retorno definida:
          // Se estiver concluída ou em andamento no mesmo dia, verifica se a infração é na mesma data a partir da saída
          const depDayStr = format(depDate, 'yyyy-MM-dd');
          if (fineDate === depDayStr && infractionTimestamp >= depTime) {
            retTime = new Date(`${fineDate}T23:59:59`).getTime();
          } else if (d.status === 'em_viagem') {
            retTime = Date.now();
          } else {
            return;
          }
        } else {
          const retDate = parseISO(d.data_retorno!);
          if (!isValid(retDate)) return;
          retTime = retDate.getTime();
        }

        if (infractionTimestamp >= depTime && infractionTimestamp <= retTime) {
          const sectorObj = sectors.find(sec => sec.id === d.setor_id);
          const pessoasNames = (d.pessoas || []).map(p => p.name).filter(Boolean);
          const motoristaStr = pessoasNames.length > 0 ? pessoasNames.join(', ') : (d.user_name || 'Servidor da Viagem');

          matches.push({
            id: `diaria_${d.id}`,
            source: 'diarias',
            sourceLabel: 'Diária',
            protocol: `DIA-${d.id.substring(0, 8).toUpperCase()}`,
            driver: motoristaStr,
            requester: d.user_name || (d.pessoas && d.pessoas[0]?.name) || 'Não informado',
            sector: sectorObj ? (sectorObj.full_name || sectorObj.name) : 'Setor Não Informado',
            destination: d.destino || 'Não informado',
            purpose: d.motivo || 'Finalidade não preenchida',
            departureDateTime: d.data_saida,
            returnDateTime: d.data_retorno || 'Em trânsito / Sem retorno registrado',
            vehicleModel: targetVehicle ? `${targetVehicle.brand} ${targetVehicle.model}` : (rawVeiculoStr || 'Veículo Municipal'),
            vehiclePlate: targetVehicle?.plate || targetPlateClean || 'Não informada',
            status: d.status,
            passengers: pessoasNames.length > 1 ? pessoasNames.slice(1) : undefined,
            rawRecord: d
          });
        }
      } catch (e) {
        console.warn('Erro ao processar datas da diária:', d.id, e);
      }
    });

    // Desduplicação inteligente caso haja id idêntico em mesma fonte
    const uniqueMatches: FineMatchResult[] = [];
    const seen = new Set<string>();

    for (const m of matches) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        uniqueMatches.push(m);
      }
    }

    setResults(uniqueMatches);
    setIsSearching(false);
  }, [
    selectedVehicleId, 
    fineDate, 
    fineTime, 
    vehicles, 
    schedules, 
    diarias, 
    cleanPlate, 
    normalizeStr, 
    persons, 
    sectors
  ]);

  // Limpar pesquisa
  const handleClear = () => {
    setSelectedVehicleId('');
    setFineDate('');
    setFineTime('');
    setResults([]);
    setHasSearched(false);
    try {
      window.history.replaceState({}, '', '/Frota/Multas');
    } catch {}
  };

  // Copiar dados da apuração para despacho oficial
  const handleCopyReport = (r: FineMatchResult) => {
    const text = `================================================
APURAÇÃO DE INFRAÇÃO DE TRÂNSITO - MUNICÍPIO
================================================
VEÍCULO: ${r.vehicleModel} (PLACA: ${r.vehiclePlate})
DATA DA INFRAÇÃO: ${fineDate ? format(parseISO(fineDate), 'dd/MM/yyyy') : ''} às ${fineTime}

DADOS DA VIAGEM CORRESPONDENTE:
------------------------------------------------
ORIGEM DO REGISTRO: ${r.sourceLabel}
CONDUTOR / MOTORISTA: ${r.driver}
SETOR RESPONSÁVEL: ${r.sector}
DESTINO: ${r.destination}
MOTIVO / FINALIDADE: ${r.purpose}
SAÍDA DA VIAGEM: ${formatDateTimeDisplay(r.departureDateTime)}
RETORNO DA VIAGEM: ${formatDateTimeDisplay(r.returnDateTime)}
SOLICITANTE: ${r.requester || 'Não informado'}
${r.protocol ? `PROTOCOLO: ${r.protocol}` : ''}
================================================
Fonte consultada: Prefeitura Integrada (Módulos Diárias e Agendamento)`;

    navigator.clipboard.writeText(text);
    setCopiedId(r.id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  // Imprimir relatório focado
  const handlePrint = () => {
    window.print();
  };

  const selectedVehicleObj = vehicles.find(v => v.id === selectedVehicleId);

  return (
    <div className="w-full flex flex-col gap-4 max-w-7xl mx-auto pb-8 print:p-0">
      {/* CABEÇALHO DA ABA MULTAS */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 md:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 print:hidden">
        <div className="flex items-start gap-3">
          <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 shrink-0 shadow-inner">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base md:text-lg font-black text-slate-900 tracking-tight">
                Localização de Condutor por Infração de Trânsito
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                Aba Multas
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200">
                /Frota/Multas
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 font-medium">
              Cruzamento simultâneo entre <strong>Diárias</strong> e <strong>Agendamento de Veículos</strong> para vincular a autuação ao condutor responsável.
            </p>
          </div>
        </div>

        {/* Status de Sincronização das Fontes */}
        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          <button
            type="button"
            onClick={loadSourcesData}
            disabled={isLoadingSources}
            className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Recarregar registros de viagens"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSources ? 'animate-spin text-amber-600' : 'text-slate-500'}`} />
            <span className="hidden sm:inline">Atualizar Bases</span>
          </button>

          {hasSearched && results.length > 0 && (
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 text-xs font-bold text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer"
              title="Imprimir relatório da infração"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir</span>
            </button>
          )}
        </div>
      </div>

      {/* ÁREA COMPACTA DE PESQUISA (RESPONSIVA VIEWPORT MÁXIMO) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-4 md:p-5 shadow-xs print:hidden">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSearch();
          }}
          className="grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end"
        >
          {/* CAMPO 1: VEÍCULO (SELECT DINÂMICO NOME/MODELO + PLACA) */}
          <div className="md:col-span-5 flex flex-col gap-1.5">
            <label className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Car className="w-3.5 h-3.5 text-amber-600" />
              <span>Veículo Infrator</span>
              <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <select
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                className="w-full text-xs md:text-sm font-bold text-slate-800 bg-slate-50 hover:bg-white border border-slate-300 rounded-xl px-3 py-2.5 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all cursor-pointer shadow-xs truncate"
                required
              >
                <option value="">Selecione o veículo (Modelo + Placa)...</option>
                {vehicles
                  .slice()
                  .sort((a, b) => (a.plate || '').localeCompare(b.plate || ''))
                  .map(v => (
                    <option key={v.id} value={v.id}>
                      {v.brand ? `${v.brand} ` : ''}{v.model} • {v.plate}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* CAMPO 2: DATA DA INFRAÇÃO */}
          <div className="md:col-span-3 flex flex-col gap-1.5">
            <label className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-600" />
              <span>Data da Infração</span>
              <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={fineDate}
              onChange={(e) => setFineDate(e.target.value)}
              className="w-full text-xs md:text-sm font-bold text-slate-800 bg-slate-50 hover:bg-white border border-slate-300 rounded-xl px-3 py-2.5 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all cursor-pointer shadow-xs"
              required
            />
          </div>

          {/* CAMPO 3: HORA DA INFRAÇÃO */}
          <div className="md:col-span-2 flex flex-col gap-1.5">
            <label className="text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>Hora da Infração</span>
              <span className="text-rose-500">*</span>
            </label>
            <input
              type="time"
              value={fineTime}
              onChange={(e) => setFineTime(e.target.value)}
              className="w-full text-xs md:text-sm font-bold text-slate-800 bg-slate-50 hover:bg-white border border-slate-300 rounded-xl px-3 py-2.5 outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all cursor-pointer shadow-xs"
              required
            />
          </div>

          {/* BOTÕES DE AÇÃO NA MESMA LINHA NO DESKTOP */}
          <div className="md:col-span-2 flex items-center gap-2">
            <button
              type="submit"
              disabled={isSearching || isLoadingSources}
              className="flex-1 py-2.5 px-3 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs md:text-sm font-black uppercase tracking-wider rounded-xl shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Search className="w-4 h-4 text-amber-400" />
              <span>Consultar</span>
            </button>

            {(selectedVehicleId || fineDate || fineTime || hasSearched) && (
              <button
                type="button"
                onClick={handleClear}
                className="p-2.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl border border-slate-200 transition-all cursor-pointer shrink-0"
                title="Limpar filtros"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </form>

        {/* RESUMO DOS REGISTROS CARREGADOS NO BANCO */}
        <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2 text-[11px] font-bold text-slate-500">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span>Diárias Carregadas: <strong>{diarias.length}</strong></span>
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Agendamentos Carregados: <strong>{schedules.length}</strong></span>
            </span>
          </div>

          {selectedVehicleObj && (
            <div className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded-lg border border-amber-200">
              Veículo Selecionado: <strong>{selectedVehicleObj.brand} {selectedVehicleObj.model} ({selectedVehicleObj.plate})</strong>
            </div>
          )}
        </div>
      </div>

      {/* RESULTADOS DA CONSULTA */}
      {hasSearched && (
        <div className="flex flex-col gap-3">
          {/* HEADER DO RESULTADO */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-900">
                Resultado da Apuração da Multa
              </h3>
              <span className={`px-2 py-0.5 rounded-full text-xs font-black ${
                results.length > 0 
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                  : 'bg-rose-100 text-rose-800 border border-rose-300'
              }`}>
                {results.length} {results.length === 1 ? 'viagem vinculada' : 'viagens vinculadas'}
              </span>
            </div>

            {results.length > 1 && (
              <span className="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                Múltiplos registros encontrados nas bases
              </span>
            )}
          </div>

          {/* CASO: SEM RESULTADOS CORRESPONDENTES */}
          {results.length === 0 && (
            <div className="bg-white rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center flex flex-col items-center justify-center gap-3 shadow-xs">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-inner">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <div className="max-w-lg">
                <h4 className="text-base md:text-lg font-black text-slate-900 tracking-tight">
                  Nenhuma viagem localizada para este veículo na data e horário informados.
                </h4>
                <p className="text-xs md:text-sm text-slate-500 mt-1 font-semibold">
                  Não associe motorista ou viagem por aproximação quando não existir correspondência válida.
                </p>
              </div>

              <div className="mt-2 p-3 bg-slate-50 rounded-xl border border-slate-200 text-left text-xs text-slate-600 max-w-md w-full flex flex-col gap-1.5">
                <div className="font-extrabold text-slate-700 flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5 text-amber-600" />
                  <span>Dicas para verificação da autuação:</span>
                </div>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-500 font-medium">
                  <li>Confira a data e o minuto exatos impressos na Notificação de Autuação de Infração (NAI);</li>
                  <li>Certifique-se de que a placa selecionada confere exatamente com o auto de infração;</li>
                  <li>Caso o deslocamento tenha sido de emergência sem registro prévio, verifique os registros manuais da frota.</li>
                </ul>
              </div>
            </div>
          )}

          {/* CASO: CORRESPONDÊNCIAS LOCALIZADAS (CARDS COMPACTOS E MODERNOS) */}
          {results.length > 0 && (
            <div className="grid grid-cols-1 gap-4">
              {results.map((r, index) => {
                const isDiaria = r.source === 'diarias';

                return (
                  <div
                    key={r.id}
                    className="bg-white rounded-2xl border-2 border-slate-200 hover:border-amber-400/80 p-4 md:p-6 shadow-xs transition-all relative overflow-hidden flex flex-col gap-4"
                  >
                    {/* FAIXA LATERAL DE ORIGEM */}
                    <div className={`absolute top-0 left-0 bottom-0 w-2 ${
                      isDiaria ? 'bg-blue-600' : 'bg-emerald-600'
                    }`} />

                    {/* CABEÇALHO DO CARD */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100 pl-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* BADGE DE ORIGEM DO REGISTRO */}
                        <span className={`px-2.5 py-1 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 shadow-xs ${
                          isDiaria 
                            ? 'bg-blue-50 text-blue-700 border border-blue-200' 
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {isDiaria ? <FileText className="w-3.5 h-3.5" /> : <Navigation className="w-3.5 h-3.5" />}
                          <span>Origem: {r.sourceLabel}</span>
                        </span>

                        {r.protocol && (
                          <span className="px-2 py-0.5 rounded-lg text-xs font-extrabold text-slate-600 bg-slate-100 border border-slate-200">
                            {r.protocol}
                          </span>
                        )}

                        <span className="px-2 py-0.5 rounded-lg text-xs font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>Viagem Ativa no Momento da Infração</span>
                        </span>
                      </div>

                      {/* AÇÕES COMPLEMENTARES */}
                      <div className="flex items-center gap-1.5 self-end sm:self-auto print:hidden">
                        <button
                          type="button"
                          onClick={() => handleCopyReport(r)}
                          className="px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                          title="Copiar dados para despacho administrativo"
                        >
                          {copiedId === r.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-700 font-extrabold">Copiado!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-slate-500" />
                              <span>Copiar Despacho</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* BLOCOS PRINCIPAIS EM DESTAQUE MÁXIMO CONFORME ESPECIFICAÇÃO: */}
                    {/* MOTORISTA | SETOR | DESTINO | MOTIVO */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pl-2">
                      {/* 1. MOTORISTA / CONDUTOR (DESTAQUE ABSOLUTO) */}
                      <div className="p-3.5 rounded-xl bg-amber-50/70 border-2 border-amber-300 flex flex-col justify-between shadow-xs">
                        <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-amber-900 mb-1">
                          <User className="w-4 h-4 text-amber-600" />
                          <span>Motorista / Condutor</span>
                        </div>
                        <div className="text-sm md:text-base font-black text-slate-900 tracking-tight break-words">
                          {r.driver}
                        </div>
                        <div className="text-[10px] text-amber-800/80 font-bold mt-1">
                          Identificado no momento da autuação
                        </div>
                      </div>

                      {/* 2. SETOR (DESTAQUE) */}
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                        <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                          <Building2 className="w-4 h-4 text-slate-500" />
                          <span>Setor Responsável</span>
                        </div>
                        <div className="text-sm md:text-base font-black text-slate-900 tracking-tight break-words">
                          {r.sector}
                        </div>
                        <div className="text-[10px] text-slate-500 font-bold mt-1">
                          Lotação do veículo/solicitação
                        </div>
                      </div>

                      {/* 3. DESTINO (DESTAQUE) */}
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                        <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                          <MapPin className="w-4 h-4 text-slate-500" />
                          <span>Destino da Viagem</span>
                        </div>
                        <div className="text-sm md:text-base font-black text-slate-900 tracking-tight break-words">
                          {r.destination}
                        </div>
                        <div className="text-[10px] text-slate-500 font-bold mt-1">
                          Trajeto registrado
                        </div>
                      </div>

                      {/* 4. MOTIVO / FINALIDADE (DESTAQUE) */}
                      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
                        <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-700 mb-1">
                          <FileText className="w-4 h-4 text-slate-500" />
                          <span>Motivo / Finalidade</span>
                        </div>
                        <div className="text-xs md:text-sm font-bold text-slate-800 break-words line-clamp-3" title={r.purpose}>
                          {r.purpose}
                        </div>
                        <div className="text-[10px] text-slate-500 font-bold mt-1">
                          Justificativa oficial
                        </div>
                      </div>
                    </div>

                    {/* DADOS DETALHADOS COMPLEMENTARES */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100 pl-2 text-xs">
                      {/* Veículo & Placa */}
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-extrabold uppercase text-slate-400">Veículo / Placa</span>
                        <span className="font-extrabold text-slate-900 flex items-center gap-1">
                          <Car className="w-3.5 h-3.5 text-slate-500" />
                          <span>{r.vehicleModel}</span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[11px]">
                            {r.vehiclePlate}
                          </span>
                        </span>
                      </div>

                      {/* Horário de Saída */}
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-extrabold uppercase text-slate-400">Saída Registrada</span>
                        <span className="font-bold text-slate-800 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-blue-500" />
                          <span>{formatDateTimeDisplay(r.departureDateTime)}</span>
                        </span>
                      </div>

                      {/* Horário de Retorno */}
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-extrabold uppercase text-slate-400">Retorno Registrado</span>
                        <span className="font-bold text-slate-800 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-emerald-500" />
                          <span>{formatDateTimeDisplay(r.returnDateTime)}</span>
                        </span>
                      </div>

                      {/* Servidor / Solicitante */}
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-extrabold uppercase text-slate-400">Servidor Solicitante</span>
                        <span className="font-bold text-slate-800 truncate" title={r.requester}>
                          {r.requester || 'Não informado'}
                        </span>
                      </div>
                    </div>

                    {/* PASSAGEIROS / OUTROS SERVIDORES VINCULADOS SE HOUVER */}
                    {r.passengers && r.passengers.length > 0 && (
                      <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-center gap-2 pl-3">
                        <Users className="w-4 h-4 text-slate-500 shrink-0" />
                        <span className="font-bold text-slate-600">Demais Ocupantes / Passageiros:</span>
                        <span className="font-extrabold text-slate-800">{r.passengers.join(', ')}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
};
