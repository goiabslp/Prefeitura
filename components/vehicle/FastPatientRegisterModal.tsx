import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ConsultaPaciente } from '../../types';
import * as db from '../../services/consultasService';
import { DuplicatePatientCpfError, DuplicatePatientConflictError } from '../../services/consultasService';
import { DuplicatePatientModal } from '../common/DuplicatePatientModal';
import { PatientConflictType } from '../../utils/patientDuplicateUtils';
import {
  normalizeCpf,
  formatCpf,
  isValidCpf,
  calculateAgeYears,
  normalizeCns,
  isValidCns
} from '../../utils/cpfUtils';
import {
  maskWhatsAppInput,
  validateWhatsApp
} from '../../utils/phoneValidation';
import {
  X,
  UserPlus,
  Save,
  Loader2,
  Calendar,
  CreditCard,
  Phone,
  MapPin,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface FastPatientRegisterModalProps {
  isOpen: boolean;
  initialQuery?: string;
  onClose: () => void;
  onSuccess: (paciente: ConsultaPaciente) => void;
}

export const FastPatientRegisterModal: React.FC<FastPatientRegisterModalProps> = ({
  isOpen,
  initialQuery = '',
  onClose,
  onSuccess
}) => {
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [cpf, setCpf] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [street, setStreet] = useState('');
  const [susNumber, setSusNumber] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingCpf, setIsCheckingCpf] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [existingDuplicate, setExistingDuplicate] = useState<ConsultaPaciente | null>(null);
  const [duplicateConflictType, setDuplicateConflictType] = useState<PatientConflictType | null>(null);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);

  const checkCpfTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Inicializa os campos a partir da pesquisa do usuário
  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setExistingDuplicate(null);
      const cleanDigits = initialQuery.replace(/\D/g, '');
      if (cleanDigits.length >= 9 && cleanDigits.length <= 11) {
        setCpf(formatCpf(cleanDigits));
        setName('');
      } else if (initialQuery.trim().length > 0 && !/^\d+$/.test(initialQuery.trim())) {
        setName(initialQuery.trim().toUpperCase());
        setCpf('');
      } else {
        setName('');
        setCpf('');
      }
      setNickname('');
      setBirthDate('');
      setPhone('');
      setNeighborhood('');
      setStreet('');
      setSusNumber('');
    }
  }, [isOpen, initialQuery]);

  const cleanCpfDigits = normalizeCpf(cpf);
  const isCpfValid = cleanCpfDigits.length === 11 && isValidCpf(cleanCpfDigits);
  const isPhoneValid = validateWhatsApp(phone).isValid;
  const isSusValid = !susNumber || normalizeCns(susNumber).length === 15;

  const calculatedAge = birthDate ? calculateAgeYears(birthDate) : null;

  // Verificação proativa de CPF já existente no banco de dados Supabase
  useEffect(() => {
    if (checkCpfTimeoutRef.current) {
      clearTimeout(checkCpfTimeoutRef.current);
    }

    if (!isOpen) return;

    if (cleanCpfDigits.length === 11 && isCpfValid) {
      checkCpfTimeoutRef.current = setTimeout(async () => {
        try {
          setIsCheckingCpf(true);
          const res = await db.lookupPacienteByCpf(cleanCpfDigits);
          if (res.status === 'found' && res.paciente) {
            setExistingDuplicate(res.paciente);
            setErrorMessage(`Este CPF já pertence ao paciente "${res.paciente.name}" na base municipal.`);
          } else if (existingDuplicate) {
            setExistingDuplicate(null);
            setErrorMessage(null);
          }
        } catch (err) {
          console.warn('[FastPatientRegisterModal] Falha ao consultar CPF prévio:', err);
        } finally {
          setIsCheckingCpf(false);
        }
      }, 350);
    } else {
      if (existingDuplicate) {
        setExistingDuplicate(null);
        setErrorMessage(null);
      }
    }

    return () => {
      if (checkCpfTimeoutRef.current) clearTimeout(checkCpfTimeoutRef.current);
    };
  }, [cleanCpfDigits, isCpfValid, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedName = name.trim().toUpperCase();
    if (trimmedName.length < 3) {
      setErrorMessage('Por favor, informe o Nome Completo do paciente (mínimo 3 letras).');
      return;
    }

    if (!isCpfValid) {
      setErrorMessage('Informe um CPF válido com 11 dígitos verificadores.');
      return;
    }

    if (!birthDate) {
      setErrorMessage('A Data de Nascimento é obrigatória para o cadastro do paciente.');
      return;
    }

    if (!isPhoneValid) {
      setErrorMessage('Informe um telefone celular/WhatsApp válido com DDD (11 dígitos).');
      return;
    }

    if (susNumber && !isSusValid) {
      setErrorMessage('O Cartão SUS deve conter 15 dígitos numéricos quando informado.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Verificação proativa de duplicidade (CPF ou Nome + Nascimento)
      const dupCheck = await db.checkDuplicatePaciente({
        name: trimmedName,
        cpf: cleanCpfDigits,
        birth_date: birthDate
      });

      if (dupCheck.hasDuplicate && dupCheck.existingPatient) {
        setExistingDuplicate(dupCheck.existingPatient);
        setDuplicateConflictType(dupCheck.conflictType);
        setIsDuplicateModalOpen(true);
        setIsSubmitting(false);
        return;
      }

      const payload: Omit<ConsultaPaciente, 'id' | 'created_at' | 'updated_at'> = {
        name: trimmedName,
        nickname: nickname.trim() ? nickname.trim().toUpperCase() : undefined,
        cpf: cleanCpfDigits,
        birth_date: birthDate,
        phone: phone.trim(),
        neighborhood: neighborhood.trim() ? neighborhood.trim().toUpperCase() : undefined,
        street: street.trim() ? street.trim().toUpperCase() : undefined,
        city: 'SÃO JOSÉ DO GOIABAL',
        sus_number: susNumber.trim() ? normalizeCns(susNumber) : undefined
      };

      const created = await db.createPaciente(payload, { strictNoDuplicate: true });
      if (created) {
        onSuccess(created);
        onClose();
      } else {
        throw new Error('Não foi possível concluir o cadastro do paciente.');
      }
    } catch (err: any) {
      console.error('Erro ao cadastrar paciente rápido:', err);
      if (err instanceof DuplicatePatientConflictError || err instanceof DuplicatePatientCpfError) {
        const existing = err.existingPatient || null;
        if (existing) {
          setExistingDuplicate(existing);
          setDuplicateConflictType((err as any).conflictType || 'cpf');
          setIsDuplicateModalOpen(true);
        } else {
          setErrorMessage(err.message || 'Paciente já cadastrado na base municipal.');
        }
      } else {
        setErrorMessage(err?.message || 'Erro ao salvar paciente na base compartilhada.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-fast-patient-title"
      >
        {/* Cabeçalho do Modal */}
        <div className="px-6 py-4.5 bg-gradient-to-r from-indigo-700 via-indigo-800 to-purple-800 text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center border border-white/20 shrink-0 shadow-inner">
              <UserPlus className="w-5 h-5 text-indigo-100" />
            </div>
            <div>
              <h3 id="modal-fast-patient-title" className="text-base font-black tracking-tight uppercase leading-none">
                Cadastrar Novo Paciente
              </h3>
              <p className="text-xs text-indigo-200 font-semibold mt-1 leading-tight">
                Base Municipal Integrada • Salvo no Supabase e compartilhado entre módulos
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 hover:text-white transition-colors cursor-pointer"
            title="Fechar formulário"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Formulário com rolagem suave */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1 custom-scrollbar text-xs bg-white">
          {/* Mensagem de Erro ou Alerta de Duplicidade */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2">
                <p className="font-bold text-xs">{errorMessage}</p>
                {existingDuplicate && (
                  <button
                    type="button"
                    onClick={() => {
                      onSuccess(existingDuplicate);
                      onClose();
                    }}
                    className="mt-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black uppercase text-[11px] tracking-wider transition-colors inline-flex items-center gap-2 cursor-pointer shadow-md active:scale-95"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Selecionar este paciente para a viagem</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 1. Nome Completo e Apelido */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
                Nome Completo <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value.toUpperCase())}
                placeholder="NOME COMPLETO DO PACIENTE"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10 outline-none transition-all placeholder:text-slate-400"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
                Apelido (Opcional)
              </label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value.toUpperCase())}
                placeholder="Ex: BETO, ZE"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10 outline-none transition-all placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* 2. CPF e Data de Nascimento em Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
                  CPF <span className="text-rose-500">*</span>
                </label>
                {isCheckingCpf && (
                  <span className="text-[10px] text-indigo-600 font-bold flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Verificando...
                  </span>
                )}
              </div>
              <input
                type="text"
                required
                maxLength={14}
                value={cpf}
                onChange={(e) => setCpf(formatCpf(e.target.value))}
                placeholder="000.000.000-00"
                className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl font-bold outline-none transition-all ${
                  cleanCpfDigits.length === 11
                    ? isCpfValid
                      ? existingDuplicate
                        ? 'border-amber-400 bg-amber-50/50 text-amber-900 focus:border-amber-600'
                        : 'border-emerald-300 bg-emerald-50/30 text-emerald-900 focus:border-emerald-600'
                      : 'border-rose-300 bg-rose-50/30 text-rose-900 focus:border-rose-600'
                    : 'border-slate-200 text-slate-900 focus:bg-white focus:border-indigo-600'
                }`}
              />
              {cleanCpfDigits.length === 11 && !isCpfValid && (
                <p className="text-[10px] text-rose-600 font-bold">Dígitos verificadores de CPF inválidos.</p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
                <Calendar className="w-3.5 h-3.5 inline mr-1 text-indigo-500" />
                Data de Nascimento <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10 outline-none transition-all"
              />
              {calculatedAge !== null && (
                <p className="text-[10px] text-indigo-600 font-bold">
                  Idade calculada: {calculatedAge} anos
                </p>
              )}
            </div>
          </div>

          {/* 3. Telefone / WhatsApp */}
          <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
              <Phone className="w-3.5 h-3.5 inline mr-1 text-indigo-500" />
              Telefone / WhatsApp <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              maxLength={17}
              value={phone}
              onChange={(e) => setPhone(maskWhatsAppInput(e.target.value))}
              placeholder="(31) 9 9999-9999"
              className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl font-bold outline-none transition-all ${
                phone.trim()
                  ? isPhoneValid
                    ? 'border-emerald-300 bg-emerald-50/30 text-emerald-900 focus:border-emerald-600'
                    : 'border-rose-300 bg-rose-50/30 text-rose-900 focus:border-rose-600'
                  : 'border-slate-200 text-slate-900 focus:bg-white focus:border-indigo-600'
              }`}
            />
            <p className="text-[10px] text-slate-400 font-medium">
              Contato obrigatório para avisos de horários e transporte.
            </p>
          </div>

          {/* 4. Bairro e Logradouro */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
                <MapPin className="w-3.5 h-3.5 inline mr-1 text-indigo-500" />
                Bairro / Comunidade
              </label>
              <input
                type="text"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value.toUpperCase())}
                placeholder="Ex: CENTRO, FAZENDA VELHA"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold focus:bg-white focus:border-indigo-600 outline-none transition-all placeholder:text-slate-400"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
                Logradouro / Endereço
              </label>
              <input
                type="text"
                value={street}
                onChange={(e) => setStreet(e.target.value.toUpperCase())}
                placeholder="Rua, número, complemento"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold focus:bg-white focus:border-indigo-600 outline-none transition-all placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* 5. Cartão SUS (Opcional) */}
          <div className="space-y-1">
            <label className="text-[11px] font-black text-slate-700 uppercase tracking-wider block">
              <CreditCard className="w-3.5 h-3.5 inline mr-1 text-indigo-500" />
              Cartão SUS (Opcional)
            </label>
            <input
              type="text"
              maxLength={15}
              value={susNumber}
              onChange={(e) => setSusNumber(e.target.value.replace(/\D/g, ''))}
              placeholder="Número CNS (15 dígitos)"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold focus:bg-white focus:border-indigo-600 outline-none transition-all placeholder:text-slate-400"
            />
          </div>

          {/* Rodapé com Botões de Ação */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl uppercase tracking-wider text-[11px] transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim() || !isCpfValid || !birthDate || !isPhoneValid || Boolean(existingDuplicate)}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 disabled:pointer-events-none text-white font-black rounded-xl uppercase tracking-wider text-[11px] shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer transition-all active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando no Supabase...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Salvar e Adicionar à Viagem</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Modal Anti-Duplicidade Oficial */}
      {isDuplicateModalOpen && existingDuplicate && (
        <DuplicatePatientModal
          isOpen={isDuplicateModalOpen}
          existingPatient={existingDuplicate}
          conflictType={duplicateConflictType}
          attemptedCandidate={{
            name,
            cpf,
            birthDate,
            phone,
            neighborhood,
            street,
            susNumber,
            nickname
          }}
          onUseExisting={(paciente) => {
            setIsDuplicateModalOpen(false);
            onSuccess(paciente);
            onClose();
          }}
          onCancel={() => {
            setIsDuplicateModalOpen(false);
          }}
          onSentToAdminConference={() => {
            setIsDuplicateModalOpen(false);
            onClose();
          }}
        />
      )}
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
