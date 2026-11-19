import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  Search, 
  Users, 
  UserCheck, 
  UserPlus, 
  ShieldAlert, 
  Check, 
  Loader2, 
  Calendar, 
  AlertCircle,
  User,
  HeartHandshake
} from 'lucide-react';
import { ConsultaPaciente, CrewMember } from '../../types';
import { searchPacientesInteligente } from '../../services/consultasService';
import { maskCpfPartial, normalizeCpf, formatBirthDateBr } from '../../utils/cpfUtils';
import { isMenorDeIdadeNaViagem, calcularIdadeNaDataViagem } from '../../utils/ageValidation';
import { FastPatientRegisterModal } from './FastPatientRegisterModal';

interface SelecionarAcompanhanteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCompanion: (companion: ConsultaPaciente) => void;
  currentPatientId?: string;
  currentPatientName?: string;
  currentPatientCpf?: string;
  isMandatoryForMinor?: boolean;
  tripDate?: string | null | Date;
  existingCrew?: CrewMember[];
}

export const SelecionarAcompanhanteModal: React.FC<SelecionarAcompanhanteModalProps> = ({
  isOpen,
  onClose,
  onSelectCompanion,
  currentPatientId,
  currentPatientName,
  currentPatientCpf,
  isMandatoryForMinor = false,
  tripDate,
  existingCrew = []
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<ConsultaPaciente[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isFastRegisterOpen, setIsFastRegisterOpen] = useState(false);
  const [validationError, setValidationError] = useState('');

  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  // Reset de estado ao abrir/fechar
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setSearchResults([]);
      setIsSearching(false);
      setValidationError('');
      setIsFastRegisterOpen(false);
      return;
    }
  }, [isOpen]);

  // Busca Inteligente na Base Municipal de Pacientes
  useEffect(() => {
    if (!isOpen) return;
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    const term = searchTerm.trim();
    if (term.length < 3) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setValidationError('');

    searchDebounceRef.current = setTimeout(async () => {
      try {
        const results = await searchPacientesInteligente(term);
        setSearchResults(results?.pacientes || []);
      } catch (err) {
        console.error('[SelecionarAcompanhanteModal] Erro ao buscar acompanhantes na base:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchTerm, isOpen]);

  if (!isOpen) return null;

  // Tentativa de selecionar um paciente como acompanhante com validações estritas
  const handleSelect = (candidate: ConsultaPaciente) => {
    setValidationError('');

    // REGRA 1: Não permitir selecionar o próprio paciente como acompanhante
    const candidateCpfClean = normalizeCpf(candidate.cpf);
    const patientCpfClean = normalizeCpf(currentPatientCpf);

    if (
      (currentPatientId && candidate.id === currentPatientId) ||
      (candidateCpfClean && patientCpfClean && candidateCpfClean === patientCpfClean)
    ) {
      setValidationError('O acompanhante não pode ser o próprio paciente.');
      return;
    }

    // REGRA 2: Não permitir duplicidade na tripulação (alguém que já está na viagem)
    const isAlreadyInTrip = existingCrew.some(p => {
      const pCpfClean = normalizeCpf(p.cpf);
      return (p.patientId && p.patientId === candidate.id) ||
             (candidateCpfClean && pCpfClean && candidateCpfClean === pCpfClean);
    });

    if (isAlreadyInTrip) {
      setValidationError(`"${candidate.name}" já está na tripulação desta viagem e não pode ser duplicado.`);
      return;
    }

    // REGRA 3: Se o paciente principal for menor de 18 anos, o acompanhante DEVE ser maior de 18 anos na data da viagem
    const candidateBirth = candidate.birth_date || (candidate as any).birthDate || '';
    if (isMandatoryForMinor && candidateBirth) {
      const candidateIsMinor = isMenorDeIdadeNaViagem(candidateBirth, tripDate);
      if (candidateIsMinor) {
        setValidationError('O acompanhante de um paciente menor de idade deve ter no mínimo 18 anos na data da viagem.');
        return;
      }
    }

    onSelectCompanion(candidate);
    onClose();
  };

  // Sucesso no cadastro rápido -> seleciona diretamente o novo paciente como acompanhante
  const handleFastPatientCreated = (novoPaciente: ConsultaPaciente) => {
    setIsFastRegisterOpen(false);
    handleSelect(novoPaciente);
  };

  const modalNode = (
    <div className="fixed inset-0 z-[320] flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        
        {/* Cabeçalho do Modal */}
        <div className="px-6 py-4 border-b border-slate-100 bg-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-purple-500/25 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight uppercase leading-none">
                Selecionar Acompanhante
              </h3>
              <p className="text-xs text-slate-400 font-semibold mt-1">
                {currentPatientName ? `Acompanhante para: ${currentPatientName}` : 'Selecione um acompanhante cadastrado na base municipal'}
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

        {/* Conteúdo com Barra de Rolagem Suave */}
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-4 flex-1">

          {/* Banner de Acompanhante Obrigatório para Menor de 18 Anos */}
          {isMandatoryForMinor && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200/90 text-amber-900 flex items-start gap-3 animate-in fade-in shadow-2xs">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <h4 className="text-xs font-black uppercase tracking-wider text-amber-900">
                  Acompanhante Obrigatório
                </h4>
                <p className="text-xs font-semibold text-amber-800 leading-relaxed">
                  Este paciente possui menos de 18 anos e deverá estar acompanhado durante a viagem. Selecione um acompanhante cadastrado para continuar.
                </p>
              </div>
            </div>
          )}

          {/* Alerta de Erro de Validação */}
          {validationError && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold flex items-center justify-between gap-2 animate-in shake">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{validationError}</span>
              </div>
              <button 
                type="button"
                onClick={() => setValidationError('')}
                className="text-rose-500 hover:text-rose-700 font-black px-1 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Campo de Pesquisa Dinâmica */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                Acompanhante (Nome ou CPF) *
              </label>
              <button
                type="button"
                onClick={() => setIsFastRegisterOpen(true)}
                className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>+ Cadastrar Novo Paciente</span>
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                autoFocus
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Pesquise por nome completo, parcial ou CPF..."
                className="w-full pl-10 pr-10 py-2.5 bg-slate-50 hover:bg-slate-100/70 focus:bg-white border border-slate-200 focus:border-purple-600 rounded-xl text-xs font-semibold text-slate-800 outline-none transition-all shadow-2xs placeholder:text-slate-400"
              />
              {isSearching ? (
                <Loader2 className="w-4 h-4 text-purple-600 animate-spin absolute right-3.5 top-1/2 -translate-y-1/2" />
              ) : searchTerm ? (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="w-5 h-5 rounded-full text-slate-400 hover:text-slate-600 absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center cursor-pointer"
                  title="Limpar pesquisa"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : null}
            </div>
            <p className="text-[10px] text-slate-400 font-medium">
              Digite pelo menos 3 letras ou os números do CPF para pesquisar na base municipal.
            </p>
          </div>

          {/* Listagem de Resultados da Busca */}
          <div className="space-y-2 pt-1">
            {isSearching ? (
              <div className="py-8 text-center text-slate-400 space-y-2">
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-purple-600" />
                <p className="text-xs font-bold">Consultando base municipal de pacientes...</p>
              </div>
            ) : searchTerm.trim().length >= 3 && searchResults.length > 0 ? (
              <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                {searchResults.map(paciente => {
                  const candidateBirth = paciente.birth_date || (paciente as any).birthDate || '';
                  const idadeNaViagem = candidateBirth ? calcularIdadeNaDataViagem(candidateBirth, tripDate) : null;
                  const isMinorCandidate = candidateBirth ? isMenorDeIdadeNaViagem(candidateBirth, tripDate) : false;
                  
                  const candidateCpfClean = normalizeCpf(paciente.cpf);
                  const patientCpfClean = normalizeCpf(currentPatientCpf);
                  const isCurrentPatient = (currentPatientId && paciente.id === currentPatientId) ||
                                           (candidateCpfClean && patientCpfClean && candidateCpfClean === patientCpfClean);

                  const isAlreadyInCrew = existingCrew.some(p => {
                    const pCpf = normalizeCpf(p.cpf);
                    return (p.patientId && p.patientId === paciente.id) ||
                           (candidateCpfClean && pCpf && candidateCpfClean === pCpf);
                  });

                  const isDisabled = isCurrentPatient || isAlreadyInCrew || (isMandatoryForMinor && isMinorCandidate);

                  return (
                    <div
                      key={paciente.id}
                      className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                        isDisabled
                          ? 'bg-slate-50 border-slate-200 opacity-60'
                          : 'bg-white border-slate-200 hover:border-purple-300 hover:bg-purple-50/30 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isDisabled ? 'bg-slate-200 text-slate-400' : 'bg-purple-100 text-purple-700'
                        }`}>
                          <User className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-black text-slate-900 uppercase truncate">
                              {paciente.name}
                            </span>
                            {paciente.nickname && (
                              <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200/80">
                                "{paciente.nickname}"
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium mt-0.5 flex-wrap">
                            <span>CPF: <strong className="text-slate-700">{maskCpfPartial(paciente.cpf)}</strong></span>
                            <span>•</span>
                            <span>
                              Nasc.: <strong className="text-slate-700">{formatBirthDateBr(paciente.birth_date)}</strong>
                              {idadeNaViagem !== null && (
                                <span className="ml-1 text-slate-500">({idadeNaViagem} anos)</span>
                              )}
                            </span>
                          </div>

                          {/* Motivo do bloqueio caso desabilitado */}
                          {isCurrentPatient && (
                            <span className="text-[10px] font-bold text-rose-600 block mt-0.5">
                              • Não pode ser o próprio paciente
                            </span>
                          )}
                          {isAlreadyInCrew && !isCurrentPatient && (
                            <span className="text-[10px] font-bold text-rose-600 block mt-0.5">
                              • Já adicionado à viagem
                            </span>
                          )}
                          {isMandatoryForMinor && isMinorCandidate && !isCurrentPatient && !isAlreadyInCrew && (
                            <span className="text-[10px] font-bold text-amber-700 block mt-0.5">
                              • Acompanhante deve ser maior de 18 anos
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isDisabled}
                        onClick={() => handleSelect(paciente)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider shrink-0 transition-all cursor-pointer ${
                          isDisabled
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-purple-600 hover:bg-purple-700 active:scale-95 text-white shadow-xs'
                        }`}
                      >
                        Selecionar
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : searchTerm.trim().length >= 3 ? (
              /* Acompanhante Não Localizado */
              <div className="py-6 px-4 text-center rounded-2xl bg-slate-50 border border-dashed border-slate-300 space-y-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
                  <HeartHandshake className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-800 uppercase">
                    Acompanhante não localizado na base municipal
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                    Nenhum passageiro ou acompanhante pode ser adicionado sem cadastro prévio na base municipal compartilhada.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsFastRegisterOpen(true)}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black rounded-xl text-xs uppercase tracking-wider inline-flex items-center gap-1.5 cursor-pointer shadow-md active:scale-95 transition-all"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ Cadastrar Novo Paciente</span>
                </button>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400">
                <Users className="w-8 h-8 mx-auto text-slate-300 mb-2 stroke-[1.5]" />
                <p className="text-xs font-bold text-slate-500">Pesquise pelo nome ou CPF da pessoa</p>
                <p className="text-[11px] text-slate-400">Os dados serão preenchidos diretamente do cadastro municipal.</p>
              </div>
            )}
          </div>
        </div>

        {/* Rodapé do Modal */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer"
          >
            Fechar
          </button>
        </div>

      </div>

      {/* Modal de Cadastro Rápido Integrado */}
      {isFastRegisterOpen && (
        <FastPatientRegisterModal
          isOpen={isFastRegisterOpen}
          initialQuery={searchTerm}
          onClose={() => setIsFastRegisterOpen(false)}
          onSuccess={handleFastPatientCreated}
        />
      )}
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalNode, document.body) : modalNode;
};
