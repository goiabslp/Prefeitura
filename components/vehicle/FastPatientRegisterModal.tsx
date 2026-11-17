import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ConsultaPaciente } from '../../types';
import * as db from '../../services/consultasService';
import { DuplicatePatientCpfError } from '../../services/consultasService';
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
  const [cpf, setCpf] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [street, setStreet] = useState('');
  const [susNumber, setSusNumber] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [existingDuplicate, setExistingDuplicate] = useState<ConsultaPaciente | null>(null);

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
      setBirthDate('');
      setPhone('');
      setNeighborhood('');
      setStreet('');
      setSusNumber('');
    }
  }, [isOpen, initialQuery]);

  if (!isOpen) return null;

  const cleanCpfDigits = normalizeCpf(cpf);
  const isCpfValid = cleanCpfDigits.length === 11 && isValidCpf(cleanCpfDigits);
  const isPhoneValid = validateWhatsApp(phone).isValid;
  const isSusValid = !susNumber || normalizeCns(susNumber).length === 15;

  const calculatedAge = birthDate ? calculateAgeYears(birthDate) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setExistingDuplicate(null);

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
      const payload: Omit<ConsultaPaciente, 'id' | 'created_at' | 'updated_at'> = {
        name: trimmedName,
        cpf: cleanCpfDigits,
        birth_date: birthDate,
        phone: phone.trim(),
        neighborhood: neighborhood.trim() || undefined,
        street: street.trim() || undefined,
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
      if (err instanceof DuplicatePatientCpfError) {
        setErrorMessage(err.message || 'Este CPF já está cadastrado na base municipal.');
        if (err.existingPatient) {
          setExistingDuplicate(err.existingPatient);
        }
      } else {
        setErrorMessage(err?.message || 'Erro ao salvar paciente na base compartilhada.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div 
        className="bg-white rounded-3xl shadow-2xl border border-slate-200/90 w-full max-w-lg overflow-hidden flex flex-col max-h-[92vh] animate-scale-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-fast-patient-title"
      >
        {/* Cabeçalho do Modal */}
        <div className="px-5 py-4 bg-gradient-to-r from-indigo-700 via-indigo-800 to-purple-800 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center border border-white/20 shrink-0 shadow-inner">
              <UserPlus className="w-5 h-5 text-indigo-100" />
            </div>
            <div>
              <h3 id="modal-fast-patient-title" className="text-sm sm:text-base font-black tracking-tight uppercase">
                Cadastrar Novo Paciente
              </h3>
              <p className="text-[11px] text-indigo-200 font-medium leading-tight">
                Base Integrada Municipal • Compartilhada com Regulação e Farmácia
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
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1 custom-scrollbar text-xs">
          {/* Mensagem de Erro ou Alerta de Duplicidade */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1.5">
                <p className="font-bold text-xs">{errorMessage}</p>
                {existingDuplicate && (
                  <button
                    type="button"
                    onClick={() => {
                      onSuccess(existingDuplicate);
                      onClose();
                    }}
                    className="mt-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold uppercase text-[10px] tracking-wider transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Usar este paciente na viagem
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Nome Completo */}
          <div>
            <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1.5">
              Nome Completo <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value.toUpperCase())}
              placeholder="NOME COMPLETO DO PACIENTE"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10 outline-none transition-all"
            />
          </div>

          {/* CPF e Data de Nascimento em Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1.5">
                CPF <span className="text-rose-500">*</span>
              </label>
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
                      ? 'border-emerald-300 bg-emerald-50/30 text-emerald-900 focus:border-emerald-600'
                      : 'border-rose-300 bg-rose-50/30 text-rose-900 focus:border-rose-600'
                    : 'border-slate-200 text-slate-900 focus:bg-white focus:border-indigo-600'
                }`}
              />
              {cleanCpfDigits.length === 11 && !isCpfValid && (
                <p className="text-[10px] text-rose-600 font-bold mt-1">Dígitos verificadores inválidos.</p>
              )}
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1.5">
                <Calendar className="w-3.5 h-3.5 inline mr-1 text-indigo-500" />
                Data de Nascimento <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold focus:bg-white focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/10 outline-none transition-all"
                />
              </div>
              {calculatedAge !== null && (
                <p className="text-[10px] text-indigo-600 font-bold mt-1">
                  Idade calculada: {calculatedAge} anos
                </p>
              )}
            </div>
          </div>

          {/* Telefone / WhatsApp */}
          <div>
            <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1.5">
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
            <p className="text-[10px] text-slate-400 font-medium mt-1">
              Contato obrigatório para avisos de transporte e consultas.
            </p>
          </div>

          {/* Bairro e Logradouro */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1.5">
                <MapPin className="w-3.5 h-3.5 inline mr-1 text-indigo-500" />
                Bairro / Comunidade
              </label>
              <input
                type="text"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value.toUpperCase())}
                placeholder="Ex: CENTRO, FAZENDA VELHA"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold focus:bg-white focus:border-indigo-600 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider mb-1.5">
                Cartão SUS (Opcional)
              </label>
              <div className="relative">
                <input
                  type="text"
                  maxLength={15}
                  value={susNumber}
                  onChange={(e) => setSusNumber(e.target.value.replace(/\D/g, ''))}
                  placeholder="Número CNS (15 dígitos)"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-bold focus:bg-white focus:border-indigo-600 outline-none transition-all"
                />
              </div>
            </div>
          </div>

          {/* Rodapé com Botões de Ação */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl uppercase tracking-wider text-[11px] border border-slate-200 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim() || !isCpfValid || !birthDate || !isPhoneValid}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-50 disabled:pointer-events-none text-white font-black rounded-xl uppercase tracking-wider text-[11px] shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer transition-all active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Salvando...</span>
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
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
