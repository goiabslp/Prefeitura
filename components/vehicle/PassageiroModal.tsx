import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  UserPlus, 
  Search, 
  Loader2, 
  AlertCircle, 
  Check, 
  Calendar, 
  MapPin, 
  HeartPulse, 
  Accessibility, 
  Users
} from 'lucide-react';
import { CrewMember, ConsultaPaciente } from '../../types';
import { searchPacientesInteligente } from '../../services/consultasService';
import { maskCpfPartial, normalizeCpf } from '../../utils/cpfUtils';
import { formatBirthDateBr } from '../../utils/cpfUtils';
import { isMenorDeIdadeNaViagem, calcularIdadeNaDataViagem } from '../../utils/ageValidation';
import { FastPatientRegisterModal } from './FastPatientRegisterModal';

interface PassageiroModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSavePassenger: (passenger: CrewMember) => void;
  onMinorDetected?: (passenger: CrewMember) => void;
  tripDate?: string | null | Date;
  editingPassenger?: CrewMember | null;
  existingPassengers?: CrewMember[];
}

const LOCAIS_EMBARQUE = [
  'Sede',
  'São José',
  'Praça Central',
  'Garagem Municipal',
  'Posto de Saúde',
  'Outro Local'
];

export const PassageiroModal: React.FC<PassageiroModalProps> = ({
  isOpen,
  onClose,
  onSavePassenger,
  onMinorDetected,
  tripDate,
  editingPassenger,
  existingPassengers = []
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<ConsultaPaciente | null>(null);
  const [searchResults, setSearchResults] = useState<ConsultaPaciente[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Campos do Formulário
  const [departureLocation, setDepartureLocation] = useState('Sede');
  const [appointmentTime, setAppointmentTime] = useState('');
  const [appointmentLocation, setAppointmentLocation] = useState('');
  const [procedureName, setProcedureName] = useState('');
  const [needsCompanion, setNeedsCompanion] = useState(false);
  const [needsAdaptedTransport, setNeedsAdaptedTransport] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Modal de Cadastro Rápido de Paciente
  const [isFastRegisterOpen, setIsFastRegisterOpen] = useState(false);

  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Inicialização ao abrir modal (novo ou edição)
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setSelectedPatient(null);
      setSearchResults([]);
      setDepartureLocation('Sede');
      setAppointmentTime('');
      setAppointmentLocation('');
      setProcedureName('');
      setNeedsCompanion(false);
      setNeedsAdaptedTransport(false);
      setErrorMessage('');
      return;
    }

    if (editingPassenger) {
      setSearchTerm(editingPassenger.name);
      setSelectedPatient({
        id: editingPassenger.patientId || editingPassenger.id || 'pax-id',
        name: editingPassenger.name,
        cpf: editingPassenger.cpf || '',
        birth_date: editingPassenger.birthDate || '',
        phone: editingPassenger.phone || ''
      });
      setDepartureLocation(editingPassenger.departureLocation || 'Sede');
      setAppointmentTime(editingPassenger.appointmentTime || '');
      setAppointmentLocation(editingPassenger.appointmentLocation || '');
      setProcedureName(editingPassenger.procedureName || '');
      setNeedsCompanion(Boolean(editingPassenger.needsCompanion || editingPassenger.companionId));
      setNeedsAdaptedTransport(Boolean(editingPassenger.needsAdaptedTransport));
    } else {
      setSearchTerm('');
      setSelectedPatient(null);
      setDepartureLocation('Sede');
      setAppointmentTime('');
      setAppointmentLocation('');
      setProcedureName('');
      setNeedsCompanion(false);
      setNeedsAdaptedTransport(false);
    }
  }, [isOpen, editingPassenger]);

  // Busca Inteligente na Base de Pacientes
  useEffect(() => {
    if (editingPassenger) return;
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    const term = searchTerm.trim();
    if (term.length < 3) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    // Se já tiver um paciente selecionado com exatamente esse nome, não reabre dropdown
    if (selectedPatient && selectedPatient.name.toUpperCase() === term.toUpperCase()) {
      return;
    }

    setIsSearching(true);
    searchDebounceRef.current = setTimeout(async () => {
      try {
        const results = await searchPacientesInteligente(term);
        setSearchResults(results?.pacientes || []);
        setIsDropdownOpen(true);
      } catch (err) {
        console.error('[PassageiroModal] Erro ao buscar pacientes:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchTerm, selectedPatient, editingPassenger]);

  if (!isOpen) return null;

  const handleSelectPatient = (paciente: ConsultaPaciente) => {
    // Validação de Duplicidade na Tripulação
    const isAlreadyInCrew = existingPassengers.some(
      p => (p.patientId && p.patientId === paciente.id) ||
           (p.cpf && paciente.cpf && normalizeCpf(p.cpf) === normalizeCpf(paciente.cpf))
    );

    if (isAlreadyInCrew && (!editingPassenger || editingPassenger.patientId !== paciente.id)) {
      setErrorMessage(`O paciente "${paciente.name}" já está adicionado à tripulação desta viagem.`);
      setIsDropdownOpen(false);
      return;
    }

    setSelectedPatient(paciente);
    setSearchTerm(paciente.name);
    setIsDropdownOpen(false);
    setErrorMessage('');
  };

  const handleFastPatientCreated = (novoPaciente: ConsultaPaciente) => {
    setIsFastRegisterOpen(false);
    handleSelectPatient(novoPaciente);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    // REGRA OBRIGATÓRIA 1: Nenhum paciente pode ser adicionado sem registro na base compartilhada!
    if (!selectedPatient) {
      setErrorMessage('Nenhum paciente selecionado. É obrigatório selecionar um paciente cadastrado na base municipal.');
      return;
    }

    const birthDate = selectedPatient.birth_date || (selectedPatient as any).birthDate || '';
    const isMinor = isMenorDeIdadeNaViagem(birthDate, tripDate);
    const idadeCalculada = calcularIdadeNaDataViagem(birthDate, tripDate);

    const passengerData: CrewMember = {
      id: editingPassenger?.id || `pax_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      patientId: selectedPatient.id,
      name: selectedPatient.name.trim().toUpperCase(),
      cpf: selectedPatient.cpf || '',
      birthDate,
      phone: selectedPatient.phone || '',
      departureLocation,
      appointmentTime,
      appointmentLocation,
      procedureName: procedureName.trim() || 'Consulta / Exame',
      type: 'paciente',
      isMinor,
      ageOnTripDate: idadeCalculada ?? undefined,
      needsCompanion,
      needsAdaptedTransport,
      companionId: editingPassenger?.companionId,
      companionName: editingPassenger?.companionName
    };

    // REGRA OBRIGATÓRIA 2: Menores de 18 anos exigem acompanhante obrigatório!
    if (isMinor && !passengerData.companionId) {
      if (onMinorDetected) {
        onMinorDetected(passengerData);
        return;
      }
    }

    onSavePassenger(passengerData);
    onClose();
  };

  return (
    <>
      {createPortal(
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
            
            {/* Header do Modal */}
            <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-violet-50/80 via-white to-purple-50/40 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/25 shrink-0">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight uppercase">
                    {editingPassenger ? 'Editar Passageiro' : 'Novo Passageiro'}
                  </h3>
                  <p className="text-xs text-slate-400 font-semibold">
                    {editingPassenger ? 'Atualize as informações do passageiro' : 'Cadastrar um novo passageiro para esta viagem'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Formulário com Scroll Interno */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-white">
              
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* 1. Campo Nome Completo com Pesquisa na Base Compartilhada */}
              <div className="space-y-1 relative">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span>Nome completo *</span>
                  <span className="text-[10px] text-indigo-600 font-bold lowercase">busca na base municipal de pacientes</span>
                </label>
                
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={searchTerm}
                    onChange={e => {
                      setSearchTerm(e.target.value);
                      if (selectedPatient && e.target.value !== selectedPatient.name) {
                        setSelectedPatient(null);
                      }
                    }}
                    placeholder="Digite o nome do passageiro..."
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 focus:bg-white border border-slate-200 focus:border-indigo-600 rounded-xl text-xs font-bold uppercase outline-none transition-all shadow-2xs"
                  />
                  {isSearching ? (
                    <Loader2 className="w-4 h-4 text-indigo-600 animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" />
                  ) : selectedPatient ? (
                    <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center absolute right-3 top-1/2 -translate-y-1/2">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  ) : null}
                </div>

                {/* Dropdown de Resultados da Pesquisa Instantânea */}
                {isDropdownOpen && searchTerm.trim().length >= 3 && !selectedPatient && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 max-h-56 overflow-y-auto custom-scrollbar p-2 divide-y divide-slate-100 animate-in fade-in">
                    {isSearching ? (
                      <div className="py-4 text-center text-slate-400 text-xs font-bold">
                        Pesquisando pacientes...
                      </div>
                    ) : searchResults.length > 0 ? (
                      searchResults.map(paciente => (
                        <div
                          key={paciente.id}
                          onClick={() => handleSelectPatient(paciente)}
                          className="p-2.5 hover:bg-indigo-50/60 rounded-xl transition-colors cursor-pointer flex items-center justify-between gap-2"
                        >
                          <div>
                            <span className="text-xs font-black text-slate-900 uppercase block">
                              {paciente.name}
                            </span>
                            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
                              <span>CPF: <strong className="text-slate-700">{maskCpfPartial(paciente.cpf)}</strong></span>
                              <span>•</span>
                              <span>Nasc: <strong className="text-slate-700">{formatBirthDateBr(paciente.birth_date)}</strong></span>
                            </div>
                          </div>
                          <span className="text-[10px] font-black uppercase px-2 py-1 bg-indigo-600 text-white rounded-lg">
                            Selecionar
                          </span>
                        </div>
                      ))
                    ) : (
                      /* Paciente não cadastrado */
                      <div className="py-4 px-3 text-center space-y-2">
                        <p className="text-xs font-black text-slate-800 uppercase">
                          Paciente não encontrado na base de dados.
                        </p>
                        <p className="text-[11px] text-slate-400 font-medium">
                          Para incluir na tripulação, é obrigatório cadastrá-lo na base compartilhada.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            setIsDropdownOpen(false);
                            setIsFastRegisterOpen(true);
                          }}
                          className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black rounded-xl text-xs uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer shadow-md"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>+ Cadastrar Novo Paciente</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 2. Linha de 2 Colunas: CPF e Data de Nascimento */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                    CPF *
                  </label>
                  <input
                    type="text"
                    required
                    readOnly
                    value={selectedPatient?.cpf ? maskCpfPartial(selectedPatient.cpf) : '000.000.000-00'}
                    placeholder="000.000.000-00"
                    className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-700 outline-none cursor-not-allowed"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                    Data de nascimento *
                  </label>
                  <input
                    type="text"
                    required
                    readOnly
                    value={selectedPatient?.birth_date ? formatBirthDateBr(selectedPatient.birth_date) : 'dd/mm/aaaa'}
                    placeholder="dd/mm/aaaa"
                    className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-not-allowed"
                  />
                </div>
              </div>

              {/* 3. Local de Embarque */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                  Local de embarque *
                </label>
                <select
                  value={departureLocation}
                  onChange={e => setDepartureLocation(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-xl text-xs font-bold text-slate-800 uppercase outline-none cursor-pointer"
                >
                  {LOCAIS_EMBARQUE.map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>

              {/* 4. Procedimento / Compromisso */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                  Procedimento / Compromisso
                </label>
                <input
                  type="text"
                  value={procedureName}
                  onChange={e => setProcedureName(e.target.value)}
                  placeholder="Ex.: Consulta, Exame, Cirurgia..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-600 rounded-xl text-xs font-semibold text-slate-800 outline-none transition-all"
                />
              </div>

              {/* 5. Linha de Toggles: Necessita de Acompanhante? & Transporte Adaptado? */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                {/* Toggle: Acompanhante */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-black uppercase text-slate-800">
                      Necessita de acompanhante?
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNeedsCompanion(!needsCompanion)}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                      needsCompanion ? 'bg-indigo-600 justify-end' : 'bg-slate-300 justify-start'
                    }`}
                  >
                    <div className="bg-white w-4 h-4 rounded-full shadow-md" />
                  </button>
                </div>

                {/* Toggle: Adaptado */}
                <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <div className="flex items-center gap-2">
                    <Accessibility className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-black uppercase text-slate-800">
                      Transporte adaptado?
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setNeedsAdaptedTransport(!needsAdaptedTransport)}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors cursor-pointer ${
                      needsAdaptedTransport ? 'bg-indigo-600 justify-end' : 'bg-slate-300 justify-start'
                    }`}
                  >
                    <div className="bg-white w-4 h-4 rounded-full shadow-md" />
                  </button>
                </div>
              </div>

              {/* Footer com Botões */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-md shadow-indigo-600/25 flex items-center gap-2 cursor-pointer active:scale-95"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{editingPassenger ? 'Salvar Alterações' : 'Adicionar Passageiro'}</span>
                </button>
              </div>

            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal de Cadastro Rápido Integrado se não encontrar */}
      {isFastRegisterOpen && (
        <FastPatientRegisterModal
          isOpen={isFastRegisterOpen}
          initialQuery={searchTerm}
          onClose={() => setIsFastRegisterOpen(false)}
          onSuccess={handleFastPatientCreated}
        />
      )}
    </>
  );
};
