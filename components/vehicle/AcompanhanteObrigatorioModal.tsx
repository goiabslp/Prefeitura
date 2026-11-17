import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  X, 
  ShieldAlert, 
  Users, 
  UserCheck, 
  Calendar, 
  Phone, 
  Check, 
  AlertCircle,
  HeartPulse
} from 'lucide-react';
import { CrewMember } from '../../types';
import { maskCpfPartial, normalizeCpf, isValidCpf } from '../../utils/cpfUtils';
import { calcularIdadeNaDataViagem, isMenorDeIdadeNaViagem } from '../../utils/ageValidation';
import { validateWhatsApp } from '../../utils/phoneValidation';

interface AcompanhanteObrigatorioModalProps {
  isOpen: boolean;
  onClose: () => void;
  pacienteMenor: CrewMember | null;
  tripDate?: string | null | Date;
  onConfirm: (paciente: CrewMember, acompanhante: CrewMember) => void;
}

export const AcompanhanteObrigatorioModal: React.FC<AcompanhanteObrigatorioModalProps> = ({
  isOpen,
  onClose,
  pacienteMenor,
  tripDate,
  onConfirm
}) => {
  const [formData, setFormData] = useState<{
    name: string;
    cpf: string;
    birthDate: string;
    phone: string;
    relationship: string;
  }>({
    name: '',
    cpf: '',
    birthDate: '',
    phone: '',
    relationship: 'Mãe'
  });

  const [errorMessage, setErrorMessage] = useState<string>('');

  if (!isOpen || !pacienteMenor) return null;

  const idadeMenor = calcularIdadeNaDataViagem(pacienteMenor.birthDate, tripDate);

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 11);
    if (v.length > 9) v = v.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
    else if (v.length > 6) v = v.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
    else if (v.length > 3) v = v.replace(/(\d{3})(\d{1,3})/, '$1.$2');
    setFormData(prev => ({ ...prev, cpf: v }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!formData.name.trim()) {
      setErrorMessage('Por favor, informe o nome completo do acompanhante responsável.');
      return;
    }

    const cleanCpf = normalizeCpf(formData.cpf);
    if (cleanCpf && cleanCpf.length === 11 && !isValidCpf(cleanCpf)) {
      setErrorMessage('O CPF informado para o acompanhante é inválido.');
      return;
    }

    // Validação Obrigatória: O acompanhante deve ter no mínimo 18 anos na data da viagem!
    if (formData.birthDate) {
      if (isMenorDeIdadeNaViagem(formData.birthDate, tripDate)) {
        setErrorMessage('O acompanhante responsável não pode ser menor de 18 anos na data da viagem.');
        return;
      }
    }

    const cleanPhone = formData.phone.trim();
    if (cleanPhone) {
      const phoneRes = validateWhatsApp(cleanPhone);
      if (!phoneRes.isValid) {
        setErrorMessage(`Telefone do acompanhante irregular: ${phoneRes.errorMessage || 'Número inválido'}`);
        return;
      }
    }

    const acompanhanteId = `acomp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const acompanhanteMembro: CrewMember = {
      id: acompanhanteId,
      name: formData.name.trim().toUpperCase(),
      cpf: formData.cpf || '',
      birthDate: formData.birthDate || '',
      phone: formData.phone || pacienteMenor.phone || '',
      departureLocation: pacienteMenor.departureLocation || 'Sede',
      appointmentTime: pacienteMenor.appointmentTime || '',
      appointmentLocation: pacienteMenor.appointmentLocation || '',
      procedureName: `Acompanhante de ${pacienteMenor.name}`,
      type: 'acompanhante',
      companionForPatientId: pacienteMenor.patientId || pacienteMenor.id,
      companionForPatientName: pacienteMenor.name,
      relationship: formData.relationship
    };

    const pacienteAtualizado: CrewMember = {
      ...pacienteMenor,
      isMinor: true,
      ageOnTripDate: idadeMenor ?? undefined,
      companionId: acompanhanteId,
      companionName: formData.name.trim().toUpperCase(),
      needsCompanion: true
    };

    onConfirm(pacienteAtualizado, acompanhanteMembro);
  };

  return createPortal(
    <div className="fixed inset-0 z-[320] flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-[2rem] shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
        
        {/* Header do Alerta */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center text-white shadow-inner shrink-0">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight uppercase leading-tight">
                Acompanhante Obrigatório
              </h3>
              <p className="text-[11px] text-amber-100 font-bold uppercase tracking-wider">
                Paciente Menor de 18 Anos
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-xl transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo com Formulário */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 custom-scrollbar bg-slate-50/50">
          
          {/* Card de Informação do Menor */}
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200/90 text-amber-950 space-y-1.5 text-xs">
            <div className="flex items-center justify-between font-black uppercase">
              <span className="flex items-center gap-1.5">
                <HeartPulse className="w-4 h-4 text-amber-700" />
                {pacienteMenor.name}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-amber-200 text-amber-900 text-[10px]">
                {idadeMenor !== null ? `${idadeMenor} anos na viagem` : 'Menor de idade'}
              </span>
            </div>
            <p className="text-[11px] text-amber-900/90 font-medium">
              "O paciente selecionado possui menos de 18 anos na data da viagem. Para realizar o transporte, é obrigatório cadastrar e vincular pelo menos um acompanhante responsável."
            </p>
          </div>

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Dados do Acompanhante */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3.5">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <Users className="w-4 h-4 text-indigo-600" />
              Identificação do Acompanhante Responsável
            </h4>

            {/* Nome Completo */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                Nome Completo do Responsável *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
                placeholder="Nome completo do acompanhante..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl text-xs font-bold uppercase outline-none"
              />
            </div>

            {/* CPF e Data de Nascimento */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                  CPF do Acompanhante
                </label>
                <input
                  type="text"
                  value={formData.cpf}
                  onChange={handleCpfChange}
                  placeholder="000.000.000-00"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl text-xs font-mono font-bold outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                  Data de Nascimento *
                </label>
                <input
                  type="date"
                  required
                  value={formData.birthDate}
                  onChange={e => setFormData({ ...formData, birthDate: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl text-xs font-bold outline-none cursor-pointer"
                />
              </div>
            </div>

            {/* Grau de Parentesco e Telefone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                  Grau de Parentesco / Vínculo *
                </label>
                <select
                  value={formData.relationship}
                  onChange={e => setFormData({ ...formData, relationship: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl text-xs font-bold uppercase outline-none cursor-pointer"
                >
                  <option value="Mãe">Mãe</option>
                  <option value="Pai">Pai</option>
                  <option value="Responsável Legal">Responsável Legal</option>
                  <option value="Avô / Avó">Avô / Avó</option>
                  <option value="Irmão / Irmã Maior">Irmão / Irmã Maior</option>
                  <option value="Tio / Tia">Tio / Tia</option>
                  <option value="Outro Acompanhante Autorizado">Outro Acompanhante Autorizado</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-600 block">
                  Telefone de Contato
                </label>
                <input
                  type="text"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(31) 98379-0670"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 rounded-xl text-xs font-bold outline-none"
                />
              </div>
            </div>

            <p className="text-[10px] text-slate-400 font-semibold italic">
              * O acompanhante ocupará 1 assento na capacidade do veículo e permanecerá vinculado ao paciente menor durante toda a viagem.
            </p>
          </div>

          {/* Footer de Ações */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:from-amber-700 hover:to-orange-700 text-white font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-md shadow-orange-500/25 flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>Vincular Acompanhante</span>
            </button>
          </div>

        </form>
      </div>
    </div>,
    document.body
  );
};
