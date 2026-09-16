import React, { useState, useMemo } from 'react';
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
  Building2
} from 'lucide-react';
import { DateTimePickerModal } from '../DateTimePickerModal';
import { supabase } from '../../services/supabaseClient';
import { Vehicle } from '../../types';

interface ConsultarVeiculoScreenProps {
  onBack: () => void;
  onSelectVehicleToSchedule?: (vehicleId: string, date: string, startTime: string, endTime: string) => void;
}

interface VeiculoDisponivel {
  id: string;
  model: string;
  brand: string;
  plate: string;
  type?: string;
  vehicle_category?: string;
  passenger_capacity?: number;
  year?: number;
  color?: string;
  status: string;
  sector_id?: string;
  sector_name?: string;
}

export const ConsultarVeiculoScreen: React.FC<ConsultarVeiculoScreenProps> = ({
  onBack,
  onSelectVehicleToSchedule
}) => {
  // 1. Data da consulta
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // 2. Horário Inicial (HH:mm)
  const [horaInicial, setHoraInicial] = useState<string>('08:00');

  // 3. Horário Final (HH:mm)
  const [horaFinal, setHoraFinal] = useState<string>('12:00');

  // Estados de consulta e resultado
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [veiculosDisponiveis, setVeiculosDisponiveis] = useState<VeiculoDisponivel[]>([]);
  const [ultimaConsulta, setUltimaConsulta] = useState<{
    dataStr: string;
    horaInicial: string;
    horaFinal: string;
  } | null>(null);

  // Validação dos 3 campos
  const validation = useMemo(() => {
    if (!selectedDate) {
      return { isValid: false, message: 'Selecione uma data para a consulta.' };
    }
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
      return { 
        isValid: false, 
        message: 'O horário final deve ser estritamente maior que o horário inicial.' 
      };
    }

    return { isValid: true, message: '' };
  }, [selectedDate, horaInicial, horaFinal]);

  // Formatação visual da data selecionada
  const formattedDateDisplay = useMemo(() => {
    if (!selectedDate) {
      return {
        dateFormatted: 'Selecione a data',
        weekday: 'Clique para escolher'
      };
    }
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const year = selectedDate.getFullYear();
    const weekday = selectedDate.toLocaleDateString('pt-BR', { weekday: 'long' });
    const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
    return {
      dateFormatted: `${day}/${month}/${year}`,
      weekday: capitalizedWeekday
    };
  }, [selectedDate]);

  // Execução da consulta otimizada no banco de dados (sem localStorage, com proteção de Egress)
  const handlePesquisar = async () => {
    if (!validation.isValid) return;

    setIsLoading(true);
    try {
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const dateIsoPrefix = `${year}-${month}-${day}`;

      // Monta as timestamps ISO locais para o início e fim da consulta
      const startDateTimeLocal = new Date(`${dateIsoPrefix}T${horaInicial}:00`);
      const endDateTimeLocal = new Date(`${dateIsoPrefix}T${horaFinal}:00`);

      const queryStartIso = startDateTimeLocal.toISOString();
      const queryEndIso = endDateTimeLocal.toISOString();

      // 1. Busca veículos operacionais, dados de setores e agendamentos conflitantes em paralelo
      const [
        { data: rawVehicles, error: vErr },
        { data: sectorsData },
        { data: conflictingSchedules, error: sErr }
      ] = await Promise.all([
        supabase
          .from('vehicles')
          .select('id, model, brand, plate, type, vehicle_category, passenger_capacity, year, color, status, available_for_scheduling, sector_id')
          .order('plate', { ascending: true }),
        supabase
          .from('sectors')
          .select('id, name'),
        supabase
          .from('vehicle_schedules')
          .select('vehicle_id, departure_date_time, return_date_time, status')
          .in('status', ['pendente', 'confirmado', 'em_curso', 'solicitado', 'aprovado', 'programado'])
          .lt('departure_date_time', queryEndIso)
          .gt('return_date_time', queryStartIso)
      ]);

      if (vErr) throw vErr;
      if (sErr) throw sErr;

      // Mapa de setores para exibição rápida e amigável
      const sectorMap = new Map<string, string>();
      (sectorsData || []).forEach((sec: any) => {
        if (sec.id && sec.name) {
          sectorMap.set(sec.id, sec.name);
        }
      });

      // Filtra apenas veículos operacionais e marcados como disponíveis no cadastro base
      const activeVehicles = (rawVehicles || []).filter((v: any) => {
        const isOperacional = !v.status || v.status.toLowerCase() === 'operacional' || v.status.toLowerCase() === 'ativo';
        const isDisponivelGeral = v.available_for_scheduling !== 'Não' && v.available_for_scheduling !== 'nao';
        return isOperacional && isDisponivelGeral;
      });

      // Conjunto de IDs de veículos com conflito de horário
      const busyVehicleIds = new Set<string>();
      (conflictingSchedules || []).forEach((s: any) => {
        if (s.vehicle_id) {
          busyVehicleIds.add(s.vehicle_id);
        }
      });

      // 3. Os veículos livres são aqueles que NÃO possuem agendamento no intervalo
      const livres: VeiculoDisponivel[] = activeVehicles
        .filter((v: any) => !busyVehicleIds.has(v.id))
        .map((v: any) => ({
          ...v,
          sector_name: v.sector_id ? (sectorMap.get(v.sector_id) || 'Geral') : 'Geral'
        }));

      setVeiculosDisponiveis(livres);
      setUltimaConsulta({
        dataStr: `${day}/${month}/${year}`,
        horaInicial,
        horaFinal
      });
      setHasSearched(true);
    } catch (err: any) {
      console.error('[ConsultarVeiculo] Erro ao consultar veículos disponíveis:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto h-full bg-slate-50">
      {/* Barra de Navegação Superior */}
      <div className="bg-white border-b border-slate-200/80 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0 shadow-sm sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack} 
            className="w-11 h-11 bg-white rounded-2xl flex items-center justify-center text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200/80 shadow-sm transition-all active:scale-95 group"
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
              Consulta de veículos livres e disponíveis por data e horário
            </p>
          </div>
        </div>

        {/* Badge Informativo */}
        <div className="hidden lg:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 text-xs font-semibold">
          <Info className="w-4 h-4 text-indigo-500" />
          <span>Verificação em tempo real sem sobreposições</span>
        </div>
      </div>

      {/* Conteúdo Central */}
      <div className="p-4 md:p-8 max-w-6xl w-full mx-auto space-y-6">
        {/* Card do Formulário de Consulta com exatamente 03 Campos */}
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
                Informe a data, a hora de início e a hora de término desejadas
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* CAMPO 1: DATA */}
            <div className="flex flex-col space-y-2">
              <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <CalendarIcon className="w-4 h-4 text-violet-600" />
                1. Data da Viagem
              </label>

              <button
                type="button"
                onClick={() => setIsDatePickerOpen(true)}
                className="w-full text-left px-4 py-3 bg-slate-50 hover:bg-violet-50/60 border border-slate-200 hover:border-violet-300 rounded-2xl transition-all group flex items-center justify-between shadow-inner"
              >
                <div>
                  <div className="text-sm font-black text-slate-800 group-hover:text-violet-900 tracking-tight">
                    {formattedDateDisplay.dateFormatted}
                  </div>
                  <div className="text-[11px] font-bold text-violet-600 uppercase tracking-wider">
                    {formattedDateDisplay.weekday}
                  </div>
                </div>
                <div className="p-2 bg-white rounded-xl shadow-xs text-slate-400 group-hover:text-violet-600 transition-colors">
                  <CalendarDays className="w-4 h-4" />
                </div>
              </button>
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
                  className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-2xl text-sm font-black text-slate-800 tracking-wider shadow-inner outline-none transition-all"
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
                  className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 focus:border-purple-500 rounded-2xl text-sm font-black text-slate-800 tracking-wider shadow-inner outline-none transition-all"
                />
              </div>
              <span className="text-[10px] text-slate-400 font-semibold">Formato 24 horas (HH:mm)</span>
            </div>
          </div>

          {/* Mensagem de validação inline (sem alert/confirm) */}
          {!validation.isValid && validation.message && (
            <div className="mt-4 p-3 bg-rose-50 border border-rose-200/80 rounded-2xl flex items-center gap-2.5 text-rose-700 text-xs font-semibold animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{validation.message}</span>
            </div>
          )}

          {/* BOTÃO DE PESQUISA */}
          <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-400 font-medium hidden sm:block">
              Verifica conflitos com agendamentos Solicitados, Aprovados e Programados.
            </div>

            <button
              type="button"
              disabled={!validation.isValid || isLoading}
              onClick={handlePesquisar}
              className={`w-full sm:w-auto px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2.5 shadow-lg transition-all active:scale-95 ${
                validation.isValid && !isLoading
                  ? 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-violet-500/25 hover:-translate-y-0.5 cursor-pointer'
                  : 'bg-slate-200 text-slate-400 shadow-none cursor-not-allowed'
              }`}
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Consultando Disponibilidade...</span>
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Pesquisar Veículos Disponíveis</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* ÁREA DE RESULTADOS */}
        {hasSearched && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-300">
            {/* Resumo do Topo */}
            <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-base shadow-sm ${
                  veiculosDisponiveis.length > 0 
                    ? 'bg-emerald-50 text-emerald-600 border border-emerald-200/60' 
                    : 'bg-amber-50 text-amber-600 border border-amber-200/60'
                }`}>
                  {veiculosDisponiveis.length}
                </div>
                <div>
                  <h4 className="text-base font-black text-slate-900 tracking-tight">
                    {veiculosDisponiveis.length === 1 
                      ? '1 veículo disponível' 
                      : `${veiculosDisponiveis.length} veículos disponíveis`}
                  </h4>
                  {ultimaConsulta && (
                    <p className="text-xs text-slate-500 font-medium">
                      Consulta realizada para <span className="font-bold text-slate-700">{ultimaConsulta.dataStr}</span> das <span className="font-bold text-slate-700">{ultimaConsulta.horaInicial}</span> às <span className="font-bold text-slate-700">{ultimaConsulta.horaFinal}</span>
                    </p>
                  )}
                </div>
              </div>

              {veiculosDisponiveis.length > 0 && (
                <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200/60 self-start sm:self-auto">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Prontos para agendamento</span>
                </div>
              )}
            </div>

            {/* Quando nenhum veículo estiver disponível */}
            {veiculosDisponiveis.length === 0 ? (
              <div className="bg-white rounded-3xl p-10 text-center border border-slate-200 shadow-xs max-w-lg mx-auto space-y-3">
                <div className="w-16 h-16 rounded-3xl bg-amber-50 text-amber-600 border border-amber-200/80 flex items-center justify-center mx-auto shadow-sm">
                  <Car className="w-8 h-8" />
                </div>
                <h4 className="text-lg font-black text-slate-800 tracking-tight">
                  Nenhum veículo disponível para o período informado.
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Todos os veículos operacionais possuem viagens agendadas ou conflitantes para este mesmo horário. Experimente consultar outro intervalo de horas ou outra data.
                </p>
              </div>
            ) : (
              /* Grade de Cards dos Veículos Livres */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {veiculosDisponiveis.map((v) => (
                  <div
                    key={v.id}
                    className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm hover:shadow-md hover:border-violet-300 transition-all flex flex-col justify-between group relative overflow-hidden"
                  >
                    {/* Linha de Destaque Superior */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 to-teal-500" />

                    <div>
                      {/* Topo do Card: Placa e Indicador DISPONÍVEL */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        {/* Placa Estilo Mercosul / Oficial */}
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-900 text-white rounded-lg font-mono font-bold text-xs tracking-wider shadow-xs">
                          <span className="text-[9px] text-sky-400 font-sans font-bold">BR</span>
                          <span>{v.plate}</span>
                        </div>

                        {/* Indicador Visual DISPONÍVEL */}
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 border border-emerald-300/80 text-emerald-700 text-[10px] font-black uppercase tracking-wider rounded-lg shadow-xs">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          DISPONÍVEL
                        </span>
                      </div>

                      {/* Modelo e Marca */}
                      <h4 className="text-lg font-black text-slate-900 tracking-tight uppercase group-hover:text-violet-700 transition-colors">
                        {v.model}
                      </h4>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
                        {v.brand || 'Marca não informada'}
                      </p>

                      {/* Informações Relevantes */}
                      <div className="space-y-2 text-xs border-t border-slate-100 pt-3 text-slate-600 font-medium">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 flex items-center gap-1">
                            <Tag className="w-3.5 h-3.5 text-slate-400" /> Categoria / Tipo:
                          </span>
                          <span className="font-bold text-slate-700 uppercase">
                            {v.vehicle_category || v.type || 'Geral'}
                          </span>
                        </div>

                        {v.passenger_capacity !== undefined && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400 flex items-center gap-1">
                              <Users className="w-3.5 h-3.5 text-slate-400" /> Capacidade:
                            </span>
                            <span className="font-bold text-slate-700">
                              {v.passenger_capacity} passageiros
                            </span>
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          <span className="text-slate-400 flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5 text-slate-400" /> Setor do Veículo:
                          </span>
                          <span className="font-bold text-slate-700 uppercase truncate max-w-[150px]" title={v.sector_name || 'Geral'}>
                            {v.sector_name || 'Geral'}
                          </span>
                        </div>

                        {v.color && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Cor:</span>
                            <span className="font-bold text-slate-700 uppercase">{v.color}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Botão de Ação Rápida */}
                    {onSelectVehicleToSchedule && (
                      <div className="mt-5 pt-3 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => {
                            if (ultimaConsulta) {
                              onSelectVehicleToSchedule(
                                v.id,
                                ultimaConsulta.dataStr,
                                ultimaConsulta.horaInicial,
                                ultimaConsulta.horaFinal
                              );
                            }
                          }}
                          className="w-full py-2 px-3 bg-violet-50 hover:bg-violet-600 text-violet-700 hover:text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 active:scale-95 shadow-xs"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Agendar este Veículo</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

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
