import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  UserPlus, 
  Search, 
  Loader2, 
  AlertCircle, 
  Check, 
  CheckCircle2,
  Calendar, 
  MapPin, 
  Clock,
  FileText,
  Accessibility, 
  Users,
  Database,
  User,
  ShieldAlert
} from 'lucide-react';
import { CrewMember, ConsultaPaciente } from '../../types';
import { searchPacientesInteligente } from '../../services/consultasService';
import { supabase } from '../../services/supabaseClient';
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

export const PassageiroModal: React.FC<PassageiroModalProps> = ({
  isOpen,
  onClose,
  onSavePassenger,
  onMinorDetected,
  tripDate,
  editingPassenger,
  existingPassengers = []
}) => {
  // 1. Estados de Busca e Paciente Selecionado
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<ConsultaPaciente | null>(null);
  const [searchResults, setSearchResults] = useState<ConsultaPaciente[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // 2. Campos Automáticos e Formulário
  const [nicknameDisplay, setNicknameDisplay] = useState('');
  const [birthDateDisplay, setBirthDateDisplay] = useState('');
  const [departureLocation, setDepartureLocation] = useState('');
  const [departureTime, setDepartureTime] = useState('');
  const [procedureName, setProcedureName] = useState('');
  const [needsCompanion, setNeedsCompanion] = useState(false);
  const [needsAdaptedTransport, setNeedsAdaptedTransport] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // 3. Modal de Cadastro Rápido de Paciente (caso não exista na base)
  const [isFastRegisterOpen, setIsFastRegisterOpen] = useState(false);

  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Consulta apelido oficial diretamente no Supabase
  const fetchPatientNicknameFromDb = async (patientId: string): Promise<string> => {
    try {
      const { data, error } = await supabase
        .from('consultas_pacientes')
        .select('nickname')
        .eq('id', patientId)
        .maybeSingle();

      if (!error && data) {
        const nick = (data.nickname || (data as any).apelido || '').trim();
        return nick || 'Não informado';
      }
    } catch (err) {
      console.warn('[PassageiroModal] Falha ao recuperar apelido do paciente no Supabase:', err);
    }
    return 'Não informado';
  };

  // Inicialização ao abrir modal (novo ou edição)
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setSelectedPatient(null);
      setSearchResults([]);
      setNicknameDisplay('');
      setBirthDateDisplay('');
      setDepartureLocation('');
      setDepartureTime('');
      setProcedureName('');
      setNeedsCompanion(false);
      setNeedsAdaptedTransport(false);
      setErrorMessage('');
      setSuccessMessage('');
      setIsDropdownOpen(false);
      return;
    }

    if (editingPassenger) {
      setSearchTerm(editingPassenger.name);
      const patientId = editingPassenger.patientId || editingPassenger.id || 'pax-id';
      setSelectedPatient({
        id: patientId,
        name: editingPassenger.name,
        cpf: editingPassenger.cpf || '',
        birth_date: editingPassenger.birthDate || '',
        nickname: editingPassenger.nickname || '',
        phone: editingPassenger.phone || ''
      });
      setBirthDateDisplay(editingPassenger.birthDate ? formatBirthDateBr(editingPassenger.birthDate) : 'Não informada');
      setNicknameDisplay(editingPassenger.nickname ? editingPassenger.nickname : 'Não informado');
      setDepartureLocation(editingPassenger.departureLocation || '');
      setDepartureTime(editingPassenger.departureTime || editingPassenger.appointmentTime || '');
      setProcedureName(editingPassenger.procedureName || '');
      setNeedsCompanion(Boolean(editingPassenger.needsCompanion || editingPassenger.companionId));
      setNeedsAdaptedTransport(Boolean(editingPassenger.needsAdaptedTransport));
      setErrorMessage('');
      setSuccessMessage('');

      // Sincroniza apelido oficial do cadastro do paciente no Supabase
      if (editingPassenger.patientId) {
        fetchPatientNicknameFromDb(editingPassenger.patientId).then(officialNick => {
          setNicknameDisplay(officialNick);
        });
      }
    } else {
      setSearchTerm('');
      setSelectedPatient(null);
      setSearchResults([]);
      setNicknameDisplay('');
      setBirthDateDisplay('');
      setDepartureLocation('');
      setDepartureTime('');
      setProcedureName('');
      setNeedsCompanion(false);
      setNeedsAdaptedTransport(false);
      setErrorMessage('');
      setSuccessMessage('');
      setIsDropdownOpen(false);
    }
  }, [isOpen, editingPassenger]);

  // Busca Inteligente na Base Municipal de Pacientes (Nome ou CPF)
  useEffect(() => {
    if (editingPassenger) return;
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    const term = searchTerm.trim();
    if (term.length < 3) {
      setSearchResults([]);
      setIsSearching(false);
      setIsDropdownOpen(false);
      return;
    }

    // Se o paciente selecionado corresponder exatamente à busca, não reabre o dropdown
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
        console.error('[PassageiroModal] Erro ao buscar pacientes na base municipal:', err);
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

  // Seleção de Paciente com Preenchimento Automático Obrigatório
  const handleSelectPatient = async (paciente: ConsultaPaciente) => {
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

    // 1. Vincula o paciente original da base municipal
    setSelectedPatient(paciente);
    setSearchTerm(paciente.name);
    setIsDropdownOpen(false);
    setErrorMessage('');

    // 2. Preenche Data de Nascimento
    const birthRaw = paciente.birth_date || (paciente as any).birthDate || '';
    setBirthDateDisplay(birthRaw ? formatBirthDateBr(birthRaw) : 'Não informada');

    // Se for menor de 18 anos, já sinaliza a obrigatoriedade de acompanhante
    const isMinor = isMenorDeIdadeNaViagem(birthRaw, tripDate);
    if (isMinor) {
      setNeedsCompanion(true);
    }

    // 3. Recupera o APELIDO registrado exclusivamente no cadastro do paciente
    const localNick = (paciente.nickname || (paciente as any).apelido || '').trim();
    setNicknameDisplay(localNick || 'Não informado');

    // Sugere local de embarque se estiver vazio e o paciente possuir endereço cadastrado
    if (!departureLocation.trim()) {
      const parts = [paciente.street, paciente.neighborhood].filter(Boolean);
      if (parts.length > 0) {
        setDepartureLocation(parts.join(' - '));
      }
    }

    // Consulta oficial no Supabase para garantir sincronização estrita
    const dbNick = await fetchPatientNicknameFromDb(paciente.id);
    if (dbNick) {
      setNicknameDisplay(dbNick);
    }
  };

  // Limpa seleção do paciente (para trocar de paciente sem manter dados anteriores)
  const handleClearPatientSelection = () => {
    setSelectedPatient(null);
    setSearchTerm('');
    setNicknameDisplay('');
    setBirthDateDisplay('');
    setDepartureLocation('');
    setDepartureTime('');
    setSearchResults([]);
    setIsDropdownOpen(false);
    setErrorMessage('');
    setSuccessMessage('');
  };

  // Trata alteração no campo de pesquisa
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    if (selectedPatient && val.toUpperCase() !== selectedPatient.name.toUpperCase()) {
      // Ao alterar o texto, desvincula o paciente anterior para não misturar dados
      setSelectedPatient(null);
      setNicknameDisplay('');
      setBirthDateDisplay('');
      setDepartureLocation('');
      setDepartureTime('');
      setSuccessMessage('');
    }
  };

  // Cadastro rápido concluído com seleção automática obrigatória
  const handleFastPatientCreated = (novoPaciente: ConsultaPaciente) => {
    setIsFastRegisterOpen(false);
    handleSelectPatient(novoPaciente);
    setSuccessMessage(`Paciente "${novoPaciente.name}" cadastrado com sucesso e selecionado para a viagem!`);
    setTimeout(() => {
      setSuccessMessage('');
    }, 4500);
  };

  // Submissão do Formulário
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    // REGRA OBRIGATÓRIA 1: Nenhum paciente pode ser adicionado sem cadastro na base municipal
    if (!selectedPatient) {
      setErrorMessage('Nenhum paciente selecionado. É obrigatório selecionar um paciente cadastrado na base municipal.');
      return;
    }

    // REGRA OBRIGATÓRIA: Horário de Embarque é individual por passageiro e obrigatório
    if (!departureTime.trim()) {
      setErrorMessage('O campo Horário de Embarque é obrigatório para este passageiro.');
      return;
    }

    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(departureTime.trim())) {
      setErrorMessage('Informe um Horário de Embarque válido no formato HH:mm (ex: 06:30).');
      return;
    }

    // REGRA OBRIGATÓRIA: Local de Embarque é individual por passageiro e obrigatório
    if (!departureLocation.trim()) {
      setErrorMessage('O campo Local de Embarque é obrigatório para este passageiro.');
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
      nickname: nicknameDisplay !== 'Não informado' ? nicknameDisplay : undefined,
      phone: selectedPatient.phone || '',
      departureLocation: departureLocation.trim(),
      departureTime: departureTime.trim(),
      appointmentTime: departureTime.trim(),
      appointmentLocation: editingPassenger?.appointmentLocation || '',
      procedureName: procedureName.trim() || 'Consulta / Exame',
      type: 'paciente',
      isMinor,
      ageOnTripDate: idadeCalculada ?? undefined,
      needsCompanion,
      needsAdaptedTransport,
      companionId: editingPassenger?.companionId,
      companionName: editingPassenger?.companionName
    };

    // REGRA OBRIGATÓRIA 2: Menores de 18 anos exigem acompanhante obrigatório vinculado
    if (isMinor && !passengerData.companionId) {
      if (onMinorDetected) {
        onMinorDetected(passengerData);
        return;
      }
    }

    onSavePassenger(passengerData);
    onClose();
  };

  const isMinorDetected = selectedPatient && isMenorDeIdadeNaViagem(
    selectedPatient.birth_date || (selectedPatient as any).birthDate || '',
    tripDate
  );

  return (
    <>
      {createPortal(
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-5 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
            
            {/* Header do Modal com Ícone Roxo e Botão Fechar */}
            <div className="px-6 py-4 border-b border-slate-100 bg-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/25 shrink-0">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight uppercase leading-none">
                    {editingPassenger ? 'Editar Passageiro' : 'Novo Passageiro'}
                  </h3>
                  <p className="text-xs text-slate-400 font-semibold mt-1">
                    {editingPassenger ? 'Atualize as informações do passageiro' : 'Cadastrar um novo passageiro para esta viagem'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
                title="Fechar modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Formulário com Scroll Interno Limpo */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 custom-scrollbar bg-white">
              
              {/* Mensagem de Erro / Alerta */}
              {errorMessage && (
                <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Mensagem de Sucesso */}
              {successMessage && (
                <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* 1. CAMPO UNIFICADO: PACIENTE (NOME OU CPF) * */}
              <div className="space-y-1.5 relative">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                    Paciente (Nome ou CPF) *
                  </label>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsDropdownOpen(false);
                      setIsFastRegisterOpen(true);
                    }}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    title="Cadastrar novo paciente na base municipal integrada"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>+ Cadastrar Novo Paciente</span>
                  </button>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={searchTerm}
                    onChange={handleSearchChange}
                    onFocus={() => {
                      if (searchResults.length > 0 && !selectedPatient) {
                        setIsDropdownOpen(true);
                      }
                    }}
                    placeholder="Pesquise por nome completo, parcial ou CPF..."
                    className="w-full pl-10 pr-10 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-indigo-600 rounded-xl text-xs font-semibold text-slate-800 outline-none transition-all shadow-2xs placeholder:text-slate-400"
                  />
                  {isSearching ? (
                    <Loader2 className="w-4 h-4 text-indigo-600 animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" />
                  ) : searchTerm ? (
                    <button
                      type="button"
                      onClick={handleClearPatientSelection}
                      className="w-5 h-5 rounded-full text-slate-400 hover:text-slate-600 absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center cursor-pointer"
                      title="Limpar pesquisa / selecionar outro"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  ) : null}
                </div>

                {/* Card do Paciente Selecionado (Conforme imagem de referência) */}
                {selectedPatient && (
                  <div className="p-3 px-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100/90 flex items-center justify-between gap-3 animate-in fade-in shadow-2xs mt-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-black text-slate-900 uppercase block truncate">
                          {selectedPatient.name}
                        </span>
                        <span className="text-[11px] text-slate-500 font-semibold block mt-0.5">
                          CPF: {selectedPatient.cpf ? maskCpfPartial(selectedPatient.cpf) : 'Não informado'}
                        </span>
                      </div>
                    </div>
                    <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                  </div>
                )}

                {/* Dropdown de Resultados da Pesquisa Instantânea */}
                {isDropdownOpen && searchTerm.trim().length >= 3 && !selectedPatient && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 max-h-56 overflow-y-auto custom-scrollbar p-2 divide-y divide-slate-100 animate-in fade-in">
                    {isSearching ? (
                      <div className="py-4 text-center text-slate-400 text-xs font-bold">
                        Pesquisando na base municipal...
                      </div>
                    ) : searchResults.length > 0 ? (
                      searchResults.map(paciente => (
                        <div
                          key={paciente.id}
                          onClick={() => handleSelectPatient(paciente)}
                          className="p-2.5 hover:bg-indigo-50/70 rounded-xl transition-colors cursor-pointer flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <span className="text-xs font-black text-slate-900 uppercase block truncate">
                              {paciente.name}
                            </span>
                            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium mt-0.5">
                              <span>CPF: <strong className="text-slate-700">{maskCpfPartial(paciente.cpf)}</strong></span>
                              <span>•</span>
                              <span>Nasc: <strong className="text-slate-700">{formatBirthDateBr(paciente.birth_date)}</strong></span>
                              {paciente.nickname && (
                                <>
                                  <span>•</span>
                                  <span>Apelido: <strong className="text-indigo-700">{paciente.nickname}</strong></span>
                                </>
                              )}
                            </div>
                          </div>
                          <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shrink-0">
                            Selecionar
                          </span>
                        </div>
                      ))
                    ) : (
                      /* Paciente não encontrado na base municipal */
                      <div className="py-4 px-3 text-center space-y-2">
                        <p className="text-xs font-black text-slate-800 uppercase">
                          Paciente não localizado na base municipal.
                        </p>
                        <p className="text-[11px] text-slate-400 font-medium">
                          Nenhum passageiro pode ser adicionado sem cadastro na base compartilhada.
                        </p>
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setIsDropdownOpen(false);
                            setIsFastRegisterOpen(true);
                          }}
                          className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black rounded-xl text-xs uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95 transition-all"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>+ Cadastrar Novo Paciente</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 2. LINHA DE 2 COLUNAS: APELIDO & DATA DE NASCIMENTO * */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Campo Apelido (Somente Leitura e Preenchimento Automático) */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                    Apelido
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={nicknameDisplay}
                    placeholder="Preenchido automaticamente"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-default select-all"
                  />
                </div>

                {/* Campo Data de Nascimento (Somente Leitura e Preenchimento Automático) */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                    Data de nascimento *
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      readOnly
                      value={birthDateDisplay}
                      placeholder="dd/mm/aaaa"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none cursor-default"
                    />
                  </div>
                </div>
              </div>

              {/* Alerta de Menor de Idade (se detectado) */}
              {isMinorDetected && (
                <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold flex items-center gap-2 animate-in fade-in">
                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    Paciente menor de 18 anos na data da viagem. Acompanhante maior de idade é obrigatório.
                  </span>
                </div>
              )}

              {/* 3. HORÁRIO E LOCAL DE EMBARQUE DO PASSAGEIRO (INDIVIDUAIS POR PASSAGEIRO) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Horário de Embarque */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                    Horário de embarque *
                  </label>
                  <div className="relative">
                    <Clock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="time"
                      required
                      value={departureTime}
                      onChange={e => setDepartureTime(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-indigo-600 rounded-xl text-xs font-semibold text-slate-800 outline-none transition-all shadow-2xs"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">Horário previsto para embarque deste passageiro.</p>
                </div>

                {/* Local de Embarque */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                    Local de embarque *
                  </label>
                  <div className="relative">
                    <MapPin className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      required
                      value={departureLocation}
                      onChange={e => setDepartureLocation(e.target.value)}
                      placeholder="Rua, número, praça ou ponto de encontro"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-indigo-600 rounded-xl text-xs font-semibold text-slate-800 outline-none transition-all shadow-2xs placeholder:text-slate-400"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">Endereço ou referência para o motorista.</p>
                </div>
              </div>

              {/* 4. CAMPO PROCEDIMENTO / COMPROMISSO */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                  Procedimento / Compromisso
                </label>
                <div className="relative">
                  <FileText className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={procedureName}
                    onChange={e => setProcedureName(e.target.value)}
                    placeholder="Ex.: Consulta, Exame, Cirurgia..."
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-indigo-600 rounded-xl text-xs font-semibold text-slate-800 outline-none transition-all shadow-2xs placeholder:text-slate-400"
                  />
                </div>
              </div>

              {/* 5. LINHA DE TOGGLES: NECESSITA DE ACOMPANHANTE? & TRANSPORTE ADAPTADO? */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Toggle: Acompanhante */}
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/90 shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                      <Users className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-black uppercase text-slate-800 tracking-tight">
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
                <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50/80 border border-slate-200/90 shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                      <Accessibility className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-black uppercase text-slate-800 tracking-tight">
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

              {/* Footer com Botões Alinhados */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 shrink-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!selectedPatient}
                  className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-md shadow-indigo-600/25 flex items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
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

      {/* Modal de Cadastro Rápido Integrado se não encontrar na base */}
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
