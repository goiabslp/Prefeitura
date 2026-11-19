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
  ShieldAlert,
  HeartHandshake,
  Building2
} from 'lucide-react';
import { CrewMember, ConsultaPaciente } from '../../types';
import { searchPacientesInteligente } from '../../services/consultasService';
import { supabase } from '../../services/supabaseClient';
import { maskCpfPartial, normalizeCpf } from '../../utils/cpfUtils';
import { formatBirthDateBr } from '../../utils/cpfUtils';
import { isMenorDeIdadeNaViagem, calcularIdadeNaDataViagem } from '../../utils/ageValidation';
import { FastPatientRegisterModal } from './FastPatientRegisterModal';
import { SelecionarAcompanhanteModal } from './SelecionarAcompanhanteModal';

interface PassageiroModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSavePassenger: (passenger: CrewMember, companion?: CrewMember | null) => void;
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
  const [destinationPoint, setDestinationPoint] = useState('');
  const [procedureName, setProcedureName] = useState('');
  const [needsCompanion, setNeedsCompanion] = useState(false);
  const [needsAdaptedTransport, setNeedsAdaptedTransport] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // 3. Estados de Acompanhante Vinculado
  const [selectedCompanion, setSelectedCompanion] = useState<ConsultaPaciente | null>(null);
  const [companionDepartureTime, setCompanionDepartureTime] = useState('');
  const [companionDepartureLocation, setCompanionDepartureLocation] = useState('');
  const [companionDestinationPoint, setCompanionDestinationPoint] = useState('');
  const [isSelectCompanionOpen, setIsSelectCompanionOpen] = useState(false);

  // 4. Modal de Cadastro Rápido de Paciente (caso não exista na base)
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
      setDestinationPoint('');
      setProcedureName('');
      setNeedsCompanion(false);
      setNeedsAdaptedTransport(false);
      setSelectedCompanion(null);
      setCompanionDepartureTime('');
      setCompanionDepartureLocation('');
      setCompanionDestinationPoint('');
      setIsSelectCompanionOpen(false);
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
      setDestinationPoint(editingPassenger.destinationPoint || editingPassenger.appointmentLocation || '');
      setProcedureName(editingPassenger.procedureName || '');
      setNeedsAdaptedTransport(Boolean(editingPassenger.needsAdaptedTransport));
      setErrorMessage('');
      setSuccessMessage('');

      // Recupera acompanhante já vinculado ao passageiro se houver na tripulação
      const companionMember = existingPassengers.find(p => 
        (editingPassenger.companionId && p.id === editingPassenger.companionId) ||
        (p.companionForPatientId && (p.companionForPatientId === editingPassenger.patientId || p.companionForPatientId === editingPassenger.id))
      );

      if (companionMember) {
        setSelectedCompanion({
          id: companionMember.patientId || companionMember.id || 'acomp-id',
          name: companionMember.name,
          cpf: companionMember.cpf || '',
          birth_date: companionMember.birthDate || '',
          nickname: companionMember.nickname || '',
          phone: companionMember.phone || ''
        });
        setCompanionDepartureTime(companionMember.departureTime || companionMember.appointmentTime || editingPassenger.departureTime || '');
        setCompanionDepartureLocation(companionMember.departureLocation || editingPassenger.departureLocation || '');
        setCompanionDestinationPoint(companionMember.destinationPoint || companionMember.appointmentLocation || editingPassenger.destinationPoint || editingPassenger.appointmentLocation || '');
        setNeedsCompanion(true);
      } else if (editingPassenger.companionName) {
        setSelectedCompanion({
          id: editingPassenger.companionId || 'acomp-id',
          name: editingPassenger.companionName,
          cpf: '',
          birth_date: '',
          nickname: '',
          phone: ''
        });
        setCompanionDepartureTime(editingPassenger.departureTime || '');
        setCompanionDepartureLocation(editingPassenger.departureLocation || '');
        setCompanionDestinationPoint(editingPassenger.destinationPoint || editingPassenger.appointmentLocation || '');
        setNeedsCompanion(true);
      } else {
        setSelectedCompanion(null);
        setCompanionDepartureTime('');
        setCompanionDepartureLocation('');
        setCompanionDestinationPoint('');
        setNeedsCompanion(Boolean(editingPassenger.needsCompanion));
      }

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
      setDestinationPoint('');
      setProcedureName('');
      setNeedsCompanion(false);
      setNeedsAdaptedTransport(false);
      setSelectedCompanion(null);
      setCompanionDepartureTime('');
      setCompanionDepartureLocation('');
      setCompanionDestinationPoint('');
      setIsSelectCompanionOpen(false);
      setErrorMessage('');
      setSuccessMessage('');
      setIsDropdownOpen(false);
    }
  }, [isOpen, editingPassenger, existingPassengers]);

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

    // Se for menor de 18 anos, já sinaliza a obrigatoriedade e abre a seleção de acompanhante
    const isMinor = isMenorDeIdadeNaViagem(birthRaw, tripDate);
    if (isMinor) {
      setNeedsCompanion(true);
      // Se ainda não tiver acompanhante selecionado, abre o modal de seleção imediatamente
      if (!selectedCompanion) {
        setIsSelectCompanionOpen(true);
      }
    }

    // Se o novo paciente selecionado for a mesma pessoa já selecionada como acompanhante, limpa o acompanhante
    if (selectedCompanion && (
      selectedCompanion.id === paciente.id ||
      (normalizeCpf(selectedCompanion.cpf) && normalizeCpf(selectedCompanion.cpf) === normalizeCpf(paciente.cpf))
    )) {
      setSelectedCompanion(null);
    }

    // 3. Recupera o APELIDO registrado exclusivamente no cadastro do paciente
    const localNick = (paciente.nickname || (paciente as any).apelido || '').trim();
    setNicknameDisplay(localNick || 'Não informado');

    // REGRA 1: Local de Embarque e Ponto de Destino iniciam completamente vazios (sem preenchimento automático)

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
    setDestinationPoint('');
    setSelectedCompanion(null);
    setCompanionDepartureTime('');
    setCompanionDepartureLocation('');
    setCompanionDestinationPoint('');
    setSearchResults([]);
    setIsDropdownOpen(false);
    setIsSelectCompanionOpen(false);
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
      setDestinationPoint('');
      setSelectedCompanion(null);
      setCompanionDepartureTime('');
      setCompanionDepartureLocation('');
      setCompanionDestinationPoint('');
      setSuccessMessage('');
    }
  };

  // Sucesso na seleção do acompanhante vindo do SelecionarAcompanhanteModal
  const handleCompanionSelected = (companion: ConsultaPaciente) => {
    setSelectedCompanion(companion);
    setNeedsCompanion(true);
    setIsSelectCompanionOpen(false);
    setErrorMessage('');

    // Preenche automaticamente o horário do acompanhante se vazio
    if (!companionDepartureTime.trim()) {
      setCompanionDepartureTime(departureTime.trim() || '06:30');
    }

    // Ponto de destino do acompanhante pré-preenchido com o do paciente como padrão, mas editável livremente
    if (!companionDestinationPoint.trim() && destinationPoint.trim()) {
      setCompanionDestinationPoint(destinationPoint.trim());
    }

    setSuccessMessage(`Acompanhante "${companion.name}" selecionado com sucesso!`);
    setTimeout(() => {
      setSuccessMessage('');
    }, 4000);
  };

  // Ativação / Desativação do toggle "Necessita de acompanhante?"
  const handleToggleCompanion = () => {
    const isMinor = selectedPatient && isMenorDeIdadeNaViagem(
      selectedPatient.birth_date || (selectedPatient as any).birthDate || '',
      tripDate
    );

    // REGRA OBRIGATÓRIA: Não permitir desativar a opção de acompanhante para menores
    if (isMinor) {
      setErrorMessage('Este paciente possui menos de 18 anos e deverá estar acompanhado durante a viagem.');
      if (!selectedCompanion) {
        setIsSelectCompanionOpen(true);
      }
      return;
    }

    if (needsCompanion) {
      // Se estava ativo, desativa e limpa o acompanhante selecionado
      setNeedsCompanion(false);
      setSelectedCompanion(null);
      setCompanionDepartureTime('');
      setCompanionDepartureLocation('');
    } else {
      // Se estava inativo, ativa e abre imediatamente o modal de seleção se ainda não houver acompanhante
      setNeedsCompanion(true);
      if (!selectedCompanion) {
        setIsSelectCompanionOpen(true);
      }
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

    // REGRA OBRIGATÓRIA 2: Ponto de Destino é individual por passageiro e obrigatório
    if (!destinationPoint.trim()) {
      setErrorMessage('O campo Ponto de Destino é obrigatório para este passageiro.');
      return;
    }

    const birthDate = selectedPatient.birth_date || (selectedPatient as any).birthDate || '';
    const isMinor = isMenorDeIdadeNaViagem(birthDate, tripDate);
    const idadeCalculada = calcularIdadeNaDataViagem(birthDate, tripDate);

    // REGRA OBRIGATÓRIA 3: Menores de 18 anos exigem acompanhante obrigatório vinculado
    if (isMinor && !selectedCompanion) {
      setErrorMessage('Este paciente possui menos de 18 anos e deverá estar acompanhado durante a viagem. Selecione um acompanhante cadastrado para continuar.');
      setIsSelectCompanionOpen(true);
      return;
    }

    // Se houver acompanhante selecionado, valida seus campos individuais
    if (selectedCompanion) {
      const finalCompTime = companionDepartureTime.trim() || departureTime.trim();
      if (!finalCompTime) {
        setErrorMessage('Informe o Horário de Embarque do acompanhante.');
        return;
      }
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(finalCompTime)) {
        setErrorMessage('Informe um Horário de Embarque válido para o acompanhante no formato HH:mm (ex: 06:30).');
        return;
      }
      if (!companionDepartureLocation.trim() && !departureLocation.trim()) {
        setErrorMessage('Informe o Local de Embarque do acompanhante.');
        return;
      }
      if (!companionDestinationPoint.trim() && !destinationPoint.trim()) {
        setErrorMessage('Informe o Ponto de Destino do acompanhante.');
        return;
      }
    }

    // Busca acompanhante pré-existente na tripulação em caso de edição
    const existingCompanionMember = existingPassengers.find(p => 
      (editingPassenger?.companionId && p.id === editingPassenger.companionId) ||
      (p.companionForPatientId && (p.companionForPatientId === (editingPassenger?.patientId || editingPassenger?.id)))
    );

    const passengerId = editingPassenger?.id || `pax_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const acompId = existingCompanionMember?.id || editingPassenger?.companionId || `acomp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const passengerData: CrewMember = {
      id: passengerId,
      patientId: selectedPatient.id,
      name: selectedPatient.name.trim().toUpperCase(),
      cpf: selectedPatient.cpf || '',
      birthDate,
      nickname: nicknameDisplay !== 'Não informado' ? nicknameDisplay : undefined,
      phone: selectedPatient.phone || '',
      departureLocation: departureLocation.trim(),
      departureTime: departureTime.trim(),
      destinationPoint: destinationPoint.trim(),
      appointmentTime: departureTime.trim(),
      appointmentLocation: destinationPoint.trim(),
      procedureName: procedureName.trim() || 'Consulta / Exame',
      type: 'paciente',
      isMinor,
      ageOnTripDate: idadeCalculada ?? undefined,
      needsCompanion: Boolean(selectedCompanion),
      needsAdaptedTransport,
      companionId: selectedCompanion ? acompId : undefined,
      companionName: selectedCompanion ? selectedCompanion.name.trim().toUpperCase() : undefined
    };

    let companionData: CrewMember | null = null;

    if (selectedCompanion) {
      const compBirth = selectedCompanion.birth_date || (selectedCompanion as any).birthDate || '';
      const compTime = companionDepartureTime.trim() || departureTime.trim();
      const compLocation = companionDepartureLocation.trim() || departureLocation.trim();
      const compDest = companionDestinationPoint.trim() || destinationPoint.trim();

      companionData = {
        id: acompId,
        patientId: selectedCompanion.id,
        name: selectedCompanion.name.trim().toUpperCase(),
        cpf: selectedCompanion.cpf || '',
        birthDate: compBirth,
        nickname: selectedCompanion.nickname || (selectedCompanion as any).apelido || undefined,
        phone: selectedCompanion.phone || '',
        departureLocation: compLocation,
        departureTime: compTime,
        destinationPoint: compDest,
        appointmentTime: compTime,
        appointmentLocation: compDest,
        procedureName: `Acompanhante de ${passengerData.name}`,
        type: 'acompanhante',
        companionForPatientId: passengerData.patientId || passengerData.id,
        companionForPatientName: passengerData.name
      };
    }

    onSavePassenger(passengerData, companionData);
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

              {/* 4. NOVO CAMPO: PONTO DE DESTINO * */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                  Ponto de destino *
                </label>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    required
                    value={destinationPoint}
                    onChange={e => setDestinationPoint(e.target.value)}
                    placeholder="Ex.: Hospital Municipal, Clínica São Lucas, UBS Central..."
                    className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-indigo-600 rounded-xl text-xs font-semibold text-slate-800 outline-none transition-all shadow-2xs placeholder:text-slate-400"
                  />
                </div>
                <p className="text-[10px] text-slate-400 font-medium">Unidade de saúde, hospital, clínica ou endereço de destino deste passageiro.</p>
              </div>

              {/* 5. CAMPO PROCEDIMENTO / COMPROMISSO */}
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
                <div className={`flex items-center justify-between p-3.5 rounded-2xl border shadow-2xs transition-colors ${
                  isMinorDetected 
                    ? 'bg-amber-50/70 border-amber-200' 
                    : needsCompanion 
                    ? 'bg-indigo-50/60 border-indigo-200' 
                    : 'bg-slate-50/80 border-slate-200/90'
                }`}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      isMinorDetected 
                        ? 'bg-amber-100 text-amber-700' 
                        : 'bg-indigo-100 text-indigo-600'
                    }`}>
                      <Users className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-black uppercase text-slate-800 tracking-tight block truncate">
                        Necessita de acompanhante?
                      </span>
                      {isMinorDetected && (
                        <span className="text-[10px] font-bold text-amber-700 block">
                          Obrigatório (Menor de 18 anos)
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleCompanion}
                    className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors shrink-0 ${
                      isMinorDetected 
                        ? 'bg-indigo-600 justify-end cursor-not-allowed opacity-90' 
                        : needsCompanion 
                        ? 'bg-indigo-600 justify-end cursor-pointer' 
                        : 'bg-slate-300 justify-start cursor-pointer'
                    }`}
                    title={isMinorDetected ? 'Obrigatório para paciente menor de 18 anos' : 'Ativar / Desativar acompanhante'}
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

              {/* 6. SEÇÃO DEDICADA DE ACOMPANHANTE SELECIONADO OU PENDENTE */}
              {needsCompanion && (
                <div className="space-y-3 pt-1 animate-in fade-in">
                  {selectedCompanion ? (
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-50/70 via-indigo-50/40 to-white border border-purple-200/90 shadow-2xs space-y-3">
                      {/* Cabeçalho do Card */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                            <HeartHandshake className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-[10px] font-black uppercase tracking-wider text-purple-900 block leading-tight">
                              Acompanhante Vinculado
                            </span>
                            <span className="text-[11px] font-bold text-slate-700 truncate block">
                              {isMinorDetected ? 'Acompanhante Responsável na Base' : 'Acompanhante Selecionado na Base'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => setIsSelectCompanionOpen(true)}
                            className="text-[10px] font-black uppercase text-purple-700 hover:text-purple-900 bg-white hover:bg-purple-100/60 border border-purple-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer shadow-2xs"
                          >
                            Substituir
                          </button>
                          {!isMinorDetected && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCompanion(null);
                                setNeedsCompanion(false);
                                setCompanionDepartureTime('');
                                setCompanionDepartureLocation('');
                              }}
                              className="text-[10px] font-black uppercase text-rose-600 hover:text-rose-800 bg-white hover:bg-rose-50 border border-rose-200 px-2 py-1 rounded-lg transition-colors cursor-pointer shadow-2xs"
                            >
                              Remover
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Informações Cadastrais da Pessoa Selecionada */}
                      <div className="p-3 rounded-xl bg-white border border-purple-100 flex items-center justify-between gap-3 shadow-2xs">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black text-slate-900 uppercase block truncate">
                              {selectedCompanion.name}
                            </span>
                            {selectedCompanion.nickname && (
                              <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200/80">
                                "{selectedCompanion.nickname}"
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium mt-0.5 flex-wrap">
                            <span>CPF: <strong className="text-slate-700">{maskCpfPartial(selectedCompanion.cpf)}</strong></span>
                            {selectedCompanion.birth_date && (
                              <>
                                <span>•</span>
                                <span>Nasc: <strong className="text-slate-700">{formatBirthDateBr(selectedCompanion.birth_date)}</strong></span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      </div>

                      {/* Horário e Local de Embarque Individuais do Acompanhante */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-0.5">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                            Horário de embarque do acompanhante *
                          </label>
                          <div className="relative">
                            <Clock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                              type="time"
                              required
                              value={companionDepartureTime}
                              onChange={e => setCompanionDepartureTime(e.target.value)}
                              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 focus:border-purple-600 rounded-xl text-xs font-semibold text-slate-800 outline-none transition-all shadow-2xs"
                            />
                          </div>
                          <p className="text-[10px] text-slate-400 font-medium">Preenchido com o do paciente por padrão, editável.</p>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                            Local de embarque do acompanhante *
                          </label>
                          <div className="relative">
                            <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                              type="text"
                              required
                              value={companionDepartureLocation}
                              onChange={e => setCompanionDepartureLocation(e.target.value)}
                              placeholder="Endereço de embarque do acompanhante"
                              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 focus:border-purple-600 rounded-xl text-xs font-semibold text-slate-800 outline-none transition-all shadow-2xs placeholder:text-slate-400"
                            />
                          </div>
                          <p className="text-[10px] text-slate-400 font-medium">Ponto de encontro ou residência do acompanhante.</p>
                        </div>

                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                            Ponto de destino do acompanhante *
                          </label>
                          <div className="relative">
                            <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                              type="text"
                              required
                              value={companionDestinationPoint}
                              onChange={e => setCompanionDestinationPoint(e.target.value)}
                              placeholder="Hospital, clínica ou unidade de saúde de destino do acompanhante"
                              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 focus:border-purple-600 rounded-xl text-xs font-semibold text-slate-800 outline-none transition-all shadow-2xs placeholder:text-slate-400"
                            />
                          </div>
                          <p className="text-[10px] text-slate-400 font-medium">Preenchido com o do paciente por padrão, editável.</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Acompanhante Obrigatório ou Desejado mas Ainda Não Selecionado */
                    <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 shadow-2xs ${
                      isMinorDetected 
                        ? 'bg-amber-50/90 border-amber-300 text-amber-900' 
                        : 'bg-purple-50/70 border-purple-200 text-purple-900'
                    }`}>
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isMinorDetected ? 'bg-amber-100 text-amber-700' : 'bg-purple-100 text-purple-700'
                        }`}>
                          {isMinorDetected ? <ShieldAlert className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-black uppercase tracking-wider block">
                            {isMinorDetected ? 'Acompanhante Obrigatório Pendente' : 'Selecionar Acompanhante'}
                          </h4>
                          <p className="text-[11px] font-semibold opacity-85 mt-0.5 leading-snug">
                            {isMinorDetected 
                              ? 'Este paciente possui menos de 18 anos e deverá estar acompanhado durante a viagem. Selecione um acompanhante cadastrado para continuar.' 
                              : 'Clique no botão ao lado para pesquisar e selecionar um acompanhante na base municipal.'}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsSelectCompanionOpen(true)}
                        className={`px-3.5 py-2 text-white font-black text-xs uppercase tracking-wider rounded-xl shrink-0 shadow-md cursor-pointer active:scale-95 transition-all ${
                          isMinorDetected ? 'bg-amber-600 hover:bg-amber-700' : 'bg-purple-600 hover:bg-purple-700'
                        }`}
                      >
                        + Selecionar
                      </button>
                    </div>
                  )}
                </div>
              )}

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
                  disabled={!selectedPatient || (Boolean(isMinorDetected) && !selectedCompanion)}
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

      {/* Modal Selecionar Acompanhante da Base Municipal */}
      {isSelectCompanionOpen && (
        <SelecionarAcompanhanteModal
          isOpen={isSelectCompanionOpen}
          onClose={() => {
            setIsSelectCompanionOpen(false);
            // Se maior de idade fechou sem selecionar e não há acompanhante prévio, desativa o toggle
            if (!isMinorDetected && !selectedCompanion) {
              setNeedsCompanion(false);
            }
          }}
          onSelectCompanion={handleCompanionSelected}
          currentPatientId={selectedPatient?.id}
          currentPatientName={selectedPatient?.name}
          currentPatientCpf={selectedPatient?.cpf}
          isMandatoryForMinor={Boolean(isMinorDetected)}
          tripDate={tripDate}
          existingCrew={existingPassengers}
        />
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
