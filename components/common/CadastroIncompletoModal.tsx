import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ConsultaPaciente } from '../../types';
import { updatePaciente } from '../../services/consultasService';
import { useAgentesSaude } from '../../services/agentesSaudeService';
import { AlertTriangle, Check, X, Loader2, Phone, Calendar, MapPin, Building, Home, UserCheck, ShieldAlert, CreditCard, ChevronDown, Info } from 'lucide-react';

/**
 * Campos ESTRITAMENTE OBRIGATÓRIOS (Bloqueantes).
 * Sem estes campos preenchidos, o paciente não pode continuar a operação.
 * Regra: Nome Completo, CPF, Data de Nascimento, Agente de Saúde, Telefone, Bairro, Rua / Endereço, Cidade.
 */
export type RequiredPatientFieldKey = 
    | 'name' 
    | 'cpf' 
    | 'birth_date' 
    | 'phone' 
    | 'street' 
    | 'neighborhood' 
    | 'city' 
    | 'agente_saude';

/**
 * Campos OPCIONAIS / COMPLEMENTARES (Não-bloqueantes).
 * Alertados, porém NÃO travam e permitem continuar sem inserir.
 */
export type OptionalPatientFieldKey = 
    | 'sus_number' 
    | 'nickname';

export const isValueBlank = (val?: string | null): boolean => {
    if (!val) return true;
    const v = val.trim();
    if (!v) return true;
    if (
        v === '(00) 00000-0000' || 
        v === '(00) 000' || 
        v === '000.000.000-00' || 
        v === '000.000.000-0' ||
        v === '000 0000 0000 0000' ||
        v === '000000000000000' ||
        /^0+$/.test(v.replace(/\D/g, ''))
    ) return true;
    return false;
};

/**
 * Retorna apenas os campos OBRIGATÓRIOS que estão pendentes/inválidos no cadastro.
 */
export const getPendingRequiredFields = (patient?: Partial<ConsultaPaciente> | null): RequiredPatientFieldKey[] => {
    if (!patient) return [];
    const pending: RequiredPatientFieldKey[] = [];

    if (isValueBlank(patient.name)) pending.push('name');
    
    const cleanCpf = (patient.cpf || '').replace(/\D/g, '');
    if (cleanCpf.length !== 11 || /^0{11}$/.test(cleanCpf)) pending.push('cpf');

    if (isValueBlank(patient.birth_date)) pending.push('birth_date');

    const cleanPhone = (patient.phone || '').replace(/\D/g, '');
    if (cleanPhone.length < 10 || /^0+$/.test(cleanPhone)) pending.push('phone');

    if (isValueBlank(patient.street)) pending.push('street');
    if (isValueBlank(patient.neighborhood)) pending.push('neighborhood');
    if (isValueBlank(patient.city)) pending.push('city');

    if (isValueBlank(patient.agente_saude)) pending.push('agente_saude');

    return pending;
};

/**
 * Retorna os campos OPCIONAIS pendentes (ex: Cartão SUS).
 */
export const getPendingOptionalFields = (patient?: Partial<ConsultaPaciente> | null): OptionalPatientFieldKey[] => {
    if (!patient) return [];
    const pending: OptionalPatientFieldKey[] = [];

    const cleanSus = (patient.sus_number || '').replace(/\D/g, '');
    if (isValueBlank(patient.sus_number) || cleanSus.length !== 15 || /^0{15}$/.test(cleanSus)) {
        pending.push('sus_number');
    }

    return pending;
};

/**
 * Mantém compatibilidade com chamadas existentes: retorna a lista de campos obrigatórios pendentes.
 */
export const getPendingFieldsList = (patient?: Partial<ConsultaPaciente> | null): RequiredPatientFieldKey[] => {
    return getPendingRequiredFields(patient);
};

/**
 * O paciente é considerado COMPLETO se possuir todos os campos OBRIGATÓRIOS preenchidos.
 * Campos opcionais (como Cartão SUS) não travam nem bloqueiam o fluxo.
 */
export const isPatientComplete = (patient?: Partial<ConsultaPaciente> | null): boolean => {
    return getPendingRequiredFields(patient).length === 0;
};

interface CadastroIncompletoModalProps {
    isOpen: boolean;
    patient: ConsultaPaciente | null;
    onClose: () => void;
    onComplete: (updatedPatient: ConsultaPaciente) => void;
    accentColor?: 'pink' | 'sky';
    contextTitle?: string; // Ex: "Dispensação de Medicamentos" ou "Novo Agendamento"
}

export const CadastroIncompletoModal: React.FC<CadastroIncompletoModalProps> = ({
    isOpen,
    patient,
    onClose,
    onComplete,
    accentColor = 'pink',
    contextTitle
}) => {
    const { items: agentesSaudeItems } = useAgentesSaude();

    const [formValues, setFormValues] = useState<Partial<ConsultaPaciente>>({});
    const [pendingRequiredKeys, setPendingRequiredKeys] = useState<RequiredPatientFieldKey[]>([]);
    const [pendingOptionalKeys, setPendingOptionalKeys] = useState<OptionalPatientFieldKey[]>([]);
    const [loading, setLoading] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        if (patient && isOpen) {
            const req = getPendingRequiredFields(patient);
            const opt = getPendingOptionalFields(patient);
            setPendingRequiredKeys(req);
            setPendingOptionalKeys(opt);
            setFormValues({
                name: patient.name || '',
                cpf: patient.cpf || '',
                birth_date: patient.birth_date || '',
                phone: patient.phone || '',
                street: patient.street || '',
                neighborhood: patient.neighborhood || '',
                city: patient.city || 'SÃO JOSÉ DO GOIABAL -MG',
                agente_saude: patient.agente_saude || '',
                nickname: patient.nickname || '',
                sus_number: patient.sus_number || ''
            });
            setErrorMessage(null);
        }
    }, [patient, isOpen]);

    if (!isOpen || !patient) return null;

    // Se todos os obrigatórios já estiverem preenchidos, não há necessidade de bloquear
    if (pendingRequiredKeys.length === 0 && pendingOptionalKeys.length === 0) {
        return null;
    }

    const handlePhoneMask = (val: string) => {
        const clean = val.replace(/\D/g, '');
        let formatted = clean;
        if (clean.length <= 2) {
            formatted = clean;
        } else if (clean.length <= 6) {
            formatted = `(${clean.slice(0, 2)}) ${clean.slice(2)}`;
        } else if (clean.length <= 10) {
            formatted = `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
        } else {
            formatted = `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7, 11)}`;
        }
        setFormValues(prev => ({ ...prev, phone: formatted }));
    };

    const handleCpfMask = (val: string) => {
        const numbers = val.replace(/\D/g, '').slice(0, 11);
        let masked = numbers;
        if (numbers.length > 9) {
            masked = numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
        } else if (numbers.length > 6) {
            masked = numbers.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
        } else if (numbers.length > 3) {
            masked = numbers.replace(/(\d{3})(\d{1,3})/, '$1.$2');
        }
        setFormValues(prev => ({ ...prev, cpf: masked }));
    };

    const handleSusMask = (val: string) => {
        const clean = val.replace(/\D/g, '').slice(0, 15);
        let formatted = '';
        if (clean.length > 0) formatted += clean.slice(0, 3);
        if (clean.length > 3) formatted += ' ' + clean.slice(3, 7);
        if (clean.length > 7) formatted += ' ' + clean.slice(7, 11);
        if (clean.length > 11) formatted += ' ' + clean.slice(11, 15);
        setFormValues(prev => ({ ...prev, sus_number: formatted }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);

        // Validações ESTRITAS SOMENTE para os campos OBRIGATÓRIOS
        if (pendingRequiredKeys.includes('name') && isValueBlank(formValues.name)) {
            setErrorMessage('O Nome Completo do paciente é obrigatório.');
            return;
        }

        if (pendingRequiredKeys.includes('cpf')) {
            const cleanCpf = (formValues.cpf || '').replace(/\D/g, '');
            if (cleanCpf.length !== 11 || /^0{11}$/.test(cleanCpf)) {
                setErrorMessage('O CPF deve conter exatamente 11 dígitos válidos.');
                return;
            }
        }

        if (pendingRequiredKeys.includes('birth_date') && isValueBlank(formValues.birth_date)) {
            setErrorMessage('A Data de Nascimento é obrigatória.');
            return;
        }

        if (pendingRequiredKeys.includes('agente_saude') && isValueBlank(formValues.agente_saude)) {
            setErrorMessage('O Agente de Saúde (ACS) é obrigatório.');
            return;
        }

        if (pendingRequiredKeys.includes('phone')) {
            const cleanPhone = (formValues.phone || '').replace(/\D/g, '');
            if (cleanPhone.length < 10 || /^0+$/.test(cleanPhone)) {
                setErrorMessage('O Telefone é obrigatório (informe DDD + Número com pelo menos 10 dígitos).');
                return;
            }
        }

        if (pendingRequiredKeys.includes('street') && isValueBlank(formValues.street)) {
            setErrorMessage('A Rua / Endereço é obrigatória.');
            return;
        }

        if (pendingRequiredKeys.includes('neighborhood') && isValueBlank(formValues.neighborhood)) {
            setErrorMessage('O Bairro é obrigatório.');
            return;
        }

        if (pendingRequiredKeys.includes('city') && isValueBlank(formValues.city)) {
            setErrorMessage('A Cidade é obrigatória.');
            return;
        }

        // Validação Cartão SUS (OPCIONAL: Não trava se estiver vazio. Só valida se o usuário preencheu parcialmente)
        const cleanSus = (formValues.sus_number || '').replace(/\D/g, '');
        if (cleanSus.length > 0 && cleanSus.length < 15 && !/^0+$/.test(cleanSus)) {
            setErrorMessage('O Cartão SUS deve conter 15 dígitos ou pode ser deixado em branco.');
            return;
        }

        setLoading(true);
        try {
            const updatePayload: Partial<ConsultaPaciente> = {
                ...formValues,
                name: formValues.name?.trim().toUpperCase(),
                street: formValues.street?.trim().toUpperCase(),
                neighborhood: formValues.neighborhood?.trim().toUpperCase(),
                city: (formValues.city?.trim() || 'SÃO JOSÉ DO GOIABAL -MG').toUpperCase(),
                agente_saude: formValues.agente_saude?.trim().toUpperCase(),
                sus_number: cleanSus.length === 15 ? formValues.sus_number?.trim() : (patient.sus_number || null),
                phone: formValues.phone?.trim()
            };

            const updated = await updatePaciente(patient.id, updatePayload);

            if (updated) {
                // Notifica listeners globais para atualizar caches em toda a aplicação
                try {
                    window.dispatchEvent(new CustomEvent('farmacia-pacientes-changed', { detail: updated }));
                    window.dispatchEvent(new CustomEvent('consultas-pacientes-changed', { detail: updated }));
                } catch {
                    // ignore
                }

                onComplete(updated);
            } else {
                setErrorMessage('Não foi possível salvar as alterações no momento. Tente novamente.');
            }
        } catch (err: any) {
            console.error('[CadastroIncompletoModal] Erro ao atualizar paciente:', err);
            setErrorMessage(err.message || 'Erro ao atualizar dados do paciente.');
        } finally {
            setLoading(false);
        }
    };

    const isPink = accentColor === 'pink';

    const modalContent = (
        <div className="fixed inset-0 z-[99999] bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border-2 border-amber-300 overflow-hidden flex flex-col max-h-[92vh] my-auto animate-in zoom-in-95 duration-200">
                {/* Header com destaque âmbar/alerta elegante */}
                <div className={`px-6 py-4.5 ${isPink ? 'bg-gradient-to-r from-amber-500 via-rose-500 to-pink-600' : 'bg-gradient-to-r from-amber-500 via-sky-600 to-indigo-600'} text-white flex items-center justify-between gap-4 shrink-0 shadow-md`}>
                    <div className="flex items-center gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white ring-4 ring-white/10 shadow-inner shrink-0">
                            <ShieldAlert className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-[9px] font-black uppercase tracking-wider">
                                    Ação Necessária
                                </span>
                                {contextTitle && (
                                    <span className="text-[10px] font-bold text-white/80">
                                        • {contextTitle}
                                    </span>
                                )}
                            </div>
                            <h3 className="text-base sm:text-lg font-black uppercase tracking-tight mt-0.5">
                                Atualização de Cadastro do Paciente
                            </h3>
                            <p className="text-xs text-white/90 font-medium">
                                Preencha os campos obrigatórios para continuar a operação:
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition-all cursor-pointer shrink-0"
                        title="Cancelar e Fechar"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Banner de Contexto do Paciente */}
                <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                        <span className="font-black text-amber-950 uppercase truncate">
                            {patient.name}
                        </span>
                        {patient.cpf && (
                            <span className="text-amber-800 font-mono font-bold shrink-0">
                                (CPF: {patient.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")})
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                        {pendingRequiredKeys.length > 0 && (
                            <span className="text-[10px] font-black uppercase text-rose-800 bg-rose-200/80 px-2.5 py-1 rounded-lg">
                                {pendingRequiredKeys.length} {pendingRequiredKeys.length === 1 ? 'obrigatório' : 'obrigatórios'}
                            </span>
                        )}
                        {pendingOptionalKeys.length > 0 && (
                            <span className="text-[10px] font-bold uppercase text-amber-800 bg-amber-200/80 px-2.5 py-1 rounded-lg">
                                {pendingOptionalKeys.length} {pendingOptionalKeys.length === 1 ? 'opcional' : 'opcionais'}
                            </span>
                        )}
                    </div>
                </div>

                {/* Form com Scroll */}
                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1 min-h-0 bg-slate-50/50">
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                        Preencha as informações obrigatórias para prosseguir com o registro:
                    </p>

                    {errorMessage && (
                        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-2xl flex items-center gap-2.5 animate-in fade-in">
                            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>{errorMessage}</span>
                        </div>
                    )}

                    {/* SEÇÃO 1: CAMPOS OBRIGATÓRIOS PENDENTES (Exigidos para continuar) */}
                    {pendingRequiredKeys.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-rose-500" />
                                <span className="text-[11px] font-black uppercase tracking-wider text-rose-800">
                                    Dados Obrigatórios Pendentes *
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                {/* Nome Completo (se pendente) */}
                                {pendingRequiredKeys.includes('name') && (
                                    <div className="sm:col-span-2">
                                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1">
                                            Nome Completo do Paciente *
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Ex: MARIA JOSÉ DA SILVA"
                                            value={formValues.name || ''}
                                            onChange={(e) => setFormValues(prev => ({ ...prev, name: e.target.value.toUpperCase() }))}
                                            className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl border-2 border-rose-300 bg-white focus:border-pink-500 focus:outline-none transition-all uppercase shadow-inner"
                                            required
                                            autoFocus
                                        />
                                    </div>
                                )}

                                {/* CPF (se pendente) */}
                                {pendingRequiredKeys.includes('cpf') && (
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1">
                                            CPF do Paciente *
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="000.000.000-00"
                                            value={formValues.cpf || ''}
                                            onChange={(e) => handleCpfMask(e.target.value)}
                                            className="w-full px-3.5 py-2.5 text-xs font-mono font-bold rounded-xl border-2 border-rose-300 bg-white focus:border-pink-500 focus:outline-none transition-all shadow-inner"
                                            required
                                        />
                                    </div>
                                )}

                                {/* Data de Nascimento (se pendente) */}
                                {pendingRequiredKeys.includes('birth_date') && (
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-1">
                                            <Calendar className="w-3.5 h-3.5 text-pink-600" />
                                            <span>Data de Nascimento *</span>
                                        </label>
                                        <input
                                            type="date"
                                            value={formValues.birth_date || ''}
                                            onChange={(e) => setFormValues(prev => ({ ...prev, birth_date: e.target.value }))}
                                            className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl border-2 border-rose-300 bg-white focus:border-pink-500 focus:outline-none transition-all cursor-pointer shadow-inner"
                                            required
                                        />
                                    </div>
                                )}

                                {/* Agente de Saúde (ACS) (se pendente) */}
                                {pendingRequiredKeys.includes('agente_saude') && (
                                    <div className="sm:col-span-2">
                                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-1">
                                            <UserCheck className="w-3.5 h-3.5 text-indigo-600" />
                                            <span>Agente de Saúde (ACS) *</span>
                                        </label>
                                        <div className="relative">
                                            <select
                                                value={formValues.agente_saude || ''}
                                                onChange={(e) => setFormValues(prev => ({ ...prev, agente_saude: e.target.value }))}
                                                className="w-full px-3.5 py-2.5 pr-8 text-xs font-bold rounded-xl border-2 border-rose-300 bg-white focus:border-pink-500 focus:outline-none transition-all cursor-pointer appearance-none uppercase shadow-inner"
                                                required
                                            >
                                                <option value="">-- SELECIONE O AGENTE (ACS) * --</option>
                                                {agentesSaudeItems.map(item => (
                                                    <option key={item.nome} value={item.nome}>
                                                        {item.nome} {item.psf ? `(${item.psf})` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                        </div>
                                    </div>
                                )}

                                {/* Telefone / WhatsApp (se pendente) */}
                                {pendingRequiredKeys.includes('phone') && (
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-1">
                                            <Phone className="w-3.5 h-3.5 text-emerald-600" />
                                            <span>Telefone / WhatsApp *</span>
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="(00) 00000-0000"
                                            value={formValues.phone || ''}
                                            onChange={(e) => handlePhoneMask(e.target.value)}
                                            className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl border-2 border-rose-300 bg-white focus:border-pink-500 focus:outline-none transition-all shadow-inner"
                                            required
                                        />
                                    </div>
                                )}

                                {/* Bairro (se pendente) */}
                                {pendingRequiredKeys.includes('neighborhood') && (
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-1">
                                            <Building className="w-3.5 h-3.5 text-purple-600" />
                                            <span>Bairro *</span>
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Ex: CENTRO"
                                            value={formValues.neighborhood || ''}
                                            onChange={(e) => setFormValues(prev => ({ ...prev, neighborhood: e.target.value.toUpperCase() }))}
                                            className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl border-2 border-rose-300 bg-white focus:border-pink-500 focus:outline-none transition-all uppercase shadow-inner"
                                            required
                                        />
                                    </div>
                                )}

                                {/* Rua / Endereço (se pendente) */}
                                {pendingRequiredKeys.includes('street') && (
                                    <div className="sm:col-span-2">
                                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-1">
                                            <Home className="w-3.5 h-3.5 text-pink-600" />
                                            <span>Rua / Endereço Completo *</span>
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Ex: RUA PRINCIPAL, 120"
                                            value={formValues.street || ''}
                                            onChange={(e) => setFormValues(prev => ({ ...prev, street: e.target.value.toUpperCase() }))}
                                            className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl border-2 border-rose-300 bg-white focus:border-pink-500 focus:outline-none transition-all uppercase shadow-inner"
                                            required
                                        />
                                    </div>
                                )}

                                {/* Cidade (se pendente) */}
                                {pendingRequiredKeys.includes('city') && (
                                    <div className="sm:col-span-2">
                                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-1">
                                            <MapPin className="w-3.5 h-3.5 text-blue-600" />
                                            <span>Cidade *</span>
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="Ex: SÃO JOSÉ DO GOIABAL - MG"
                                            value={formValues.city || ''}
                                            onChange={(e) => setFormValues(prev => ({ ...prev, city: e.target.value.toUpperCase() }))}
                                            className="w-full px-3.5 py-2.5 text-xs font-bold rounded-xl border-2 border-rose-300 bg-white focus:border-pink-500 focus:outline-none transition-all uppercase shadow-inner"
                                            required
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* SEÇÃO 2: DEMAIS CAMPOS (OPCIONAIS / COMPLEMENTARES - NÃO TRAVAM O FLUXO) */}
                    {pendingOptionalKeys.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-slate-200">
                            <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3.5 space-y-3">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <Info className="w-4 h-4 text-amber-700 shrink-0" />
                                        <span className="text-[11px] font-black uppercase tracking-wider text-amber-900">
                                            Dados Complementares (Opcional - Não Obrigatório)
                                        </span>
                                    </div>
                                    <span className="text-[9px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                                        Pode continuar sem preencher
                                    </span>
                                </div>

                                <p className="text-[11px] text-amber-800/90 leading-tight">
                                    Estes campos complementam o cadastro mas não bloqueiam a continuidade do atendimento.
                                </p>

                                {/* Cartão SUS (Opcional) */}
                                {pendingOptionalKeys.includes('sus_number') && (
                                    <div>
                                        <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-700 mb-1 flex items-center gap-1">
                                            <CreditCard className="w-3.5 h-3.5 text-amber-600" />
                                            <span>Número do Cartão SUS (15 dígitos)</span>
                                            <span className="text-slate-400 font-normal lowercase text-[9px]">(opcional)</span>
                                        </label>
                                        <input
                                            type="text"
                                            placeholder="000 0000 0000 0000"
                                            value={formValues.sus_number || ''}
                                            onChange={(e) => handleSusMask(e.target.value)}
                                            className="w-full px-3.5 py-2.5 text-xs font-mono font-bold rounded-xl border border-amber-300 bg-white focus:border-amber-500 focus:outline-none transition-all shadow-2xs"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Rodapé e Botões */}
                    <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                        <p className="text-[11px] text-slate-400 font-medium text-center sm:text-left">
                            💡 Os dados informados serão salvos no cadastro único do paciente.
                        </p>

                        <div className="flex items-center gap-2.5 w-full sm:w-auto">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={loading}
                                className="flex-1 sm:flex-initial px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-extrabold text-xs uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50"
                            >
                                Cancelar
                            </button>

                            <button
                                type="submit"
                                disabled={loading}
                                className={`flex-1 sm:flex-initial px-6 py-2.5 ${isPink ? 'bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 shadow-pink-500/20' : 'bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 shadow-sky-500/20'} text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50`}
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Salvando...
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-4 h-4" />
                                        Salvar e Continuar
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );

    if (typeof document === 'undefined') return null;
    return createPortal(modalContent, document.body);
};

