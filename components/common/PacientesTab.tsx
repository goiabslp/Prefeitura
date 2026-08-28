import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ConsultaPaciente, ConsultaAgendamento, AGENTES_DE_SAUDE } from '../../types';
import { Search, Plus, Edit2, Trash2, X, AlertTriangle, Loader2, ChevronDown, Users, ArrowLeft } from 'lucide-react';
import * as db from '../../services/consultasService';

export const formatPatientName = (patient?: ConsultaPaciente | null) => {
    if (!patient) return '';
    return patient.nickname ? `${patient.name} (${patient.nickname})` : patient.name;
};

export const getMissingPatientFields = (patient?: Partial<ConsultaPaciente> | null): string[] => {
    if (!patient) return [];
    const isBlank = (val?: string | null) => {
        if (!val) return true;
        const v = val.trim();
        return !v || v === '(00) 00000-0000' || v === '(00) 000' || v === '000.000.000-00';
    };

    const missing: string[] = [];
    if (isBlank(patient.name)) missing.push('Nome Completo');
    if (isBlank(patient.cpf)) missing.push('CPF');
    if (isBlank(patient.birth_date)) missing.push('Data de Nascimento');
    if (isBlank(patient.phone)) missing.push('Telefone');
    if (isBlank(patient.neighborhood)) missing.push('Bairro');
    if (isBlank(patient.street)) missing.push('Rua / Endereço');
    if (isBlank(patient.city)) missing.push('Cidade');
    if (isBlank(patient.sus_number)) missing.push('Número do SUS');
    if (isBlank(patient.agente_saude)) missing.push('Agente de Saúde (ACS)');

    return missing;
};

export const isPatientIncomplete = (patient?: Partial<ConsultaPaciente> | null): boolean => {
    return getMissingPatientFields(patient).length > 0;
};

interface PacientesTabProps {
    onBack?: () => void;
    accentColor?: 'sky' | 'pink' | 'cyan';
    title?: string;
    subtitle?: string;
}

export const PacientesTab: React.FC<PacientesTabProps> = ({
    onBack,
    accentColor = 'sky',
    title = 'Pacientes Cadastrados',
    subtitle = 'Base Unificada de Pacientes (Farmácia Popular & Regulação/Consultas)'
}) => {
    const [loading, setLoading] = useState(false);

    // Patients States
    const [patients, setPatients] = useState<ConsultaPaciente[]>([]);
    const [patientSearch, setPatientSearch] = useState('');
    const [selectedPatient, setSelectedPatient] = useState<ConsultaPaciente | null>(null);
    const [patientHistory, setPatientHistory] = useState<ConsultaAgendamento[]>([]);
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
    const [editingPatient, setEditingPatient] = useState<ConsultaPaciente | null>(null);

    // Patient Form State
    const [patName, setPatName] = useState('');
    const [patNickname, setPatNickname] = useState('');
    const [patCpf, setPatCpf] = useState('');
    const [patBirthDate, setPatBirthDate] = useState('');
    const [patPhone, setPatPhone] = useState('');
    const [patNeighborhood, setPatNeighborhood] = useState('');
    const [patStreet, setPatStreet] = useState('');
    const [patCity, setPatCity] = useState('SÃO JOSÉ DO GOIABAL -MG');
    const [patSusNumber, setPatSusNumber] = useState('');
    const [patAgenteSaude, setPatAgenteSaude] = useState('');
    const [patError, setPatError] = useState('');

    const loadPatients = async () => {
        setLoading(true);
        try {
            const data = await db.getPacientes();
            setPatients(data);
        } catch (error) {
            console.error('[PacientesTab] Erro ao carregar pacientes:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPatients();
    }, []);

    // Patient Form Phone Mask
    const handlePatPhoneChange = (value: string) => {
        const numbers = value.replace(/\D/g, '').slice(0, 11);
        let masked = numbers;
        if (numbers.length > 10) {
            masked = numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
        } else if (numbers.length > 6) {
            masked = numbers.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
        } else if (numbers.length > 2) {
            masked = numbers.replace(/(\d{2})(\d{0,5})/, '($1) $2');
        }
        setPatPhone(masked);
    };

    // Patient Form CPF Mask
    const handleCpfMask = (value: string) => {
        const numbers = value.replace(/\D/g, '').slice(0, 11);
        let masked = numbers;
        if (numbers.length > 9) {
            masked = numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
        } else if (numbers.length > 6) {
            masked = numbers.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
        } else if (numbers.length > 3) {
            masked = numbers.replace(/(\d{3})(\d{1,3})/, '$1.$2');
        }
        setPatCpf(masked);
    };

    // Patient Form validation & save
    const handleSavePatient = async (e: React.FormEvent) => {
        e.preventDefault();
        setPatError('');

        const cleanCpf = patCpf.replace(/\D/g, '');
        if (cleanCpf.length !== 11) {
            setPatError('O CPF deve conter exatamente 11 dígitos.');
            return;
        }

        if (!patName.trim()) {
            setPatError('O Nome Completo é obrigatório.');
            return;
        }
        if (!patBirthDate) {
            setPatError('A Data de Nascimento é obrigatória.');
            return;
        }

        setLoading(true);
        try {
            const patientData = {
                name: patName.trim().toUpperCase(),
                nickname: patNickname.trim() ? patNickname.trim().toUpperCase() : null,
                cpf: cleanCpf,
                birth_date: patBirthDate,
                phone: patPhone.trim() || null,
                neighborhood: patNeighborhood.trim() ? patNeighborhood.trim().toUpperCase() : null,
                street: patStreet.trim() ? patStreet.trim().toUpperCase() : null,
                city: patCity.trim() ? patCity.trim().toUpperCase() : 'SÃO JOSÉ DO GOIABAL -MG',
                sus_number: patSusNumber.trim() || null,
                agente_saude: patAgenteSaude ? patAgenteSaude.toUpperCase() : null,
            };

            if (editingPatient) {
                await db.updatePaciente(editingPatient.id, patientData);
            } else {
                await db.createPaciente(patientData);
            }
            setIsPatientModalOpen(false);
            await loadPatients();
        } catch (err: any) {
            setPatError(err.message || 'Erro ao salvar paciente.');
        } finally {
            setLoading(false);
        }
    };

    const handleDeletePatient = async (patientId: string) => {
        if (!confirm('Deseja realmente excluir este paciente? Esta ação não pode ser desfeita.')) return;
        setLoading(true);
        try {
            await db.deletePaciente(patientId);
            await loadPatients();
        } catch (err: any) {
            alert(err.message || 'Erro ao deletar paciente.');
        } finally {
            setLoading(false);
        }
    };

    // Patient History Drawer
    const handleOpenHistory = async (patient: ConsultaPaciente) => {
        setSelectedPatient(patient);
        setIsHistoryOpen(true);
        try {
            const history = await db.getPacienteHistory(patient.id);
            setPatientHistory(history);
        } catch (error) {
            console.error('[PacientesTab] Erro ao carregar histórico:', error);
        }
    };

    // Open Patient Modal (Add or Edit)
    const handleOpenPatientModal = (patient?: ConsultaPaciente) => {
        if (patient) {
            setEditingPatient(patient);
            setPatName(patient.name);
            setPatNickname(patient.nickname || '');
            setPatCpf(patient.cpf);
            setPatBirthDate(patient.birth_date);
            setPatPhone(patient.phone || '');
            setPatNeighborhood(patient.neighborhood || '');
            setPatStreet(patient.street || '');
            setPatCity(patient.city || 'SÃO JOSÉ DO GOIABAL -MG');
            setPatSusNumber(patient.sus_number || '');
            setPatAgenteSaude(patient.agente_saude || '');
        } else {
            setEditingPatient(null);
            setPatName('');
            setPatNickname('');
            setPatCpf('');
            setPatBirthDate('');
            setPatPhone('');
            setPatNeighborhood('');
            setPatStreet('');
            setPatCity('SÃO JOSÉ DO GOIABAL -MG');
            setPatSusNumber('');
            setPatAgenteSaude('');
        }
        setPatError('');
        setIsPatientModalOpen(true);
    };

    const [isMobile, setIsMobile] = useState<boolean>(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const filteredPatients = useMemo(() => {
        if (isMobile && !patientSearch.trim()) return [];
        if (!patientSearch.trim()) return patients;

        const searchLower = patientSearch.toLowerCase().trim();
        const cleanNumbers = searchLower.replace(/\D/g, '');

        return patients.filter(p => {
            const nameMatch = p.name ? p.name.toLowerCase().includes(searchLower) : false;
            const nicknameMatch = p.nickname ? p.nickname.toLowerCase().includes(searchLower) : false;
            
            const cpfClean = p.cpf ? p.cpf.replace(/\D/g, '') : '';
            const cpfMatch = cleanNumbers.length > 0 && cpfClean.includes(cleanNumbers);
            
            const susClean = p.sus_number ? p.sus_number.replace(/\D/g, '') : '';
            const susMatch = cleanNumbers.length > 0 && susClean.includes(cleanNumbers);
            
            const agenteMatch = p.agente_saude ? p.agente_saude.toLowerCase().includes(searchLower) : false;

            return nameMatch || nicknameMatch || cpfMatch || susMatch || agenteMatch;
        });
    }, [patients, patientSearch, isMobile]);

    return (
        <div className="flex-1 flex flex-col h-full min-h-0 space-y-3.5 overflow-hidden">
            {/* Header Mobile (Limpa, sem cortes, apenas 1 campo de busca) */}
            <div className="block md:hidden bg-white rounded-3xl p-3 shadow-sm border border-slate-200/80 space-y-2.5 shrink-0 overflow-hidden">
                <div className="flex items-center justify-between gap-2 w-full min-w-0">
                    <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                        {onBack && (
                            <button
                                onClick={onBack}
                                className="p-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all cursor-pointer shrink-0"
                                title="Voltar"
                            >
                                <ArrowLeft className="w-4.5 h-4.5" />
                            </button>
                        )}
                        <div className={`w-8.5 h-8.5 rounded-2xl border flex items-center justify-center shadow-2xs shrink-0 ${
                            accentColor === 'pink' ? 'bg-pink-50 border-pink-200/80 text-pink-600' : 'bg-sky-50 border-sky-200/80 text-sky-600'
                        }`}>
                            <Users className="w-4 h-4" />
                        </div>
                        <h2 className="text-xs font-black text-slate-900 uppercase tracking-tight truncate min-w-0">
                            {title}
                        </h2>
                    </div>

                    <button
                        onClick={() => handleOpenPatientModal()}
                        className={`px-3 py-1.5 text-white font-black rounded-2xl shadow-md active:scale-95 transition-all text-xs uppercase tracking-wider flex items-center gap-1 cursor-pointer shrink-0 ${
                            accentColor === 'pink' ? 'bg-pink-600 hover:bg-pink-700 shadow-pink-500/20' : 'bg-sky-600 hover:bg-sky-700 shadow-sky-500/20'
                        }`}
                    >
                        <Plus className="w-3.5 h-3.5" /> <span>Novo</span>
                    </button>
                </div>

                {/* 1 Único Campo de Busca Limpo no Mobile */}
                <div className="relative w-full">
                    <input
                        type="text"
                        placeholder="Buscar por nome, CPF ou SUS..."
                        className="w-full bg-slate-50 border border-slate-200/90 focus:bg-white focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 rounded-2xl pl-9 pr-9 py-2 text-xs font-bold transition-all text-slate-900 placeholder:text-slate-400 shadow-2xs"
                        value={patientSearch}
                        onChange={(e) => setPatientSearch(e.target.value)}
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                    {patientSearch && (
                        <button
                            type="button"
                            onClick={() => setPatientSearch('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-600 p-0.5 rounded-full hover:bg-slate-200/60 transition-colors cursor-pointer"
                            title="Limpar busca"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Header Desktop (Rigorosamente na MESMA LINHA) */}
            <div className="hidden md:flex bg-white rounded-3xl p-3.5 md:px-5 shadow-sm border border-slate-200/80 items-center justify-between gap-3 shrink-0">
                {/* Esquerda: Voltar + Ícone + Título */}
                <div className="flex items-center gap-3 shrink-0 min-w-0">
                    {onBack && (
                        <button
                            onClick={onBack}
                            className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all cursor-pointer shrink-0"
                            title="Voltar"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                    )}
                    <div className={`w-10 h-10 rounded-2xl border flex items-center justify-center shadow-sm shrink-0 ${
                        accentColor === 'pink' ? 'bg-pink-50 border-pink-200/80 text-pink-600' : 'bg-sky-50 border-sky-200/80 text-sky-600'
                    }`}>
                        <Users className="w-5 h-5" />
                    </div>
                    <div className="hidden lg:block min-w-0">
                        <h2 className="text-base font-black text-slate-900 uppercase tracking-tight leading-none truncate">
                            {title}
                        </h2>
                        <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-0.5 truncate">
                            {subtitle}
                        </p>
                    </div>
                    <div className="lg:hidden min-w-0">
                        <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight leading-none truncate">
                            {title}
                        </h2>
                    </div>
                </div>

                {/* Direita: Busca + Contador + Botão Novo Paciente na mesma linha */}
                <div className="flex items-center gap-2.5 shrink-0">
                    <div className="relative w-44 sm:w-64 lg:w-80">
                        <input
                            type="text"
                            placeholder="Buscar por Nome, Apelido, CPF ou Cartão SUS..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold placeholder:text-slate-400 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15 transition-all text-slate-900 shadow-2xs"
                            value={patientSearch}
                            onChange={(e) => setPatientSearch(e.target.value)}
                        />
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                        {patientSearch && (
                            <button
                                type="button"
                                onClick={() => setPatientSearch('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-600 p-0.5 rounded-full hover:bg-slate-200/60 transition-colors cursor-pointer"
                                title="Limpar busca"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    <div className="px-3.5 py-2 bg-sky-50 border border-sky-200/80 rounded-xl flex items-center gap-1.5 text-sky-700 font-extrabold text-xs shrink-0 shadow-2xs">
                        <Users className="w-3.5 h-3.5 text-sky-600" />
                        <span>
                            {patientSearch 
                                ? `${filteredPatients.length} de ${patients.length}` 
                                : `${patients.length}`
                            } {patients.length === 1 ? 'paciente' : 'pacientes'}
                        </span>
                    </div>

                    <button
                        onClick={() => handleOpenPatientModal()}
                        className={`px-4 py-2 text-white font-extrabold rounded-xl shadow-md active:scale-95 transition-all text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shrink-0 ${
                            accentColor === 'pink' ? 'bg-pink-600 hover:bg-pink-700 shadow-pink-500/20' : 'bg-sky-600 hover:bg-sky-700 shadow-sky-500/20'
                        }`}
                    >
                        <Plus className="w-4 h-4" /> <span className="whitespace-nowrap">Novo Paciente</span>
                    </button>
                </div>
            </div>

            {/* Tabela de Pacientes com Rolagem Interna */}
            {isMobile && !patientSearch.trim() ? (
                <div className="flex-1 bg-white border border-slate-200/80 rounded-3xl p-8 flex flex-col items-center justify-center text-center animate-in fade-in duration-300">
                    <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-sky-50 via-sky-100/60 to-blue-100 border border-sky-200/80 flex items-center justify-center text-sky-600 shadow-inner mb-4">
                        <Search className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-1">
                        Qual paciente você procura?
                    </h3>
                    <p className="text-xs font-semibold text-slate-500 max-w-md">
                        Digite o nome do paciente, apelido, CPF ou número do Cartão SUS no campo de busca para pesquisar.
                    </p>
                </div>
            ) : filteredPatients.length > 0 ? (
                <div className="flex-1 bg-white border border-slate-200 rounded-2xl overflow-y-auto min-h-0 shadow-sm">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-100 shadow-sm">
                            <tr className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                <th className="p-4">Nome</th>
                                <th className="p-4">CPF</th>
                                <th className="p-4">Nascimento</th>
                                <th className="p-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                            {filteredPatients.map(p => (
                                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="p-4">
                                        <div className="flex items-center gap-2.5 flex-wrap">
                                            <span className="font-extrabold text-slate-900">{formatPatientName(p)}</span>
                                            {isPatientIncomplete(p) && (
                                                <span 
                                                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200/80 shrink-0 shadow-2xs"
                                                    title="Cadastro incompleto: possui campos obrigatórios pendentes (Telefone, Bairro, Rua, Cidade, SUS ou ACS)"
                                                >
                                                    <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                                                    Incompleto
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="p-4">{p.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}</td>
                                    <td className="p-4">{new Date(p.birth_date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                                    <td className="p-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleOpenHistory(p)}
                                                className="px-2.5 py-1 text-slate-500 hover:text-sky-600 hover:bg-sky-50 border border-slate-200 rounded-lg text-[10px] uppercase font-bold transition-all cursor-pointer"
                                            >
                                                Histórico
                                            </button>
                                            <button
                                                onClick={() => handleOpenPatientModal(p)}
                                                className="p-1.5 text-amber-600 hover:text-white hover:bg-amber-500 border border-amber-100 hover:border-amber-500 rounded-lg transition-all cursor-pointer"
                                                title="Editar Dados"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDeletePatient(p.id)}
                                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 rounded-lg transition-all cursor-pointer"
                                                title="Excluir Paciente"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-xs font-bold text-slate-400 py-12 bg-white border border-slate-200 rounded-2xl">
                    Nenhum paciente encontrado.
                </div>
            )}

            {/* MODAL: ADD/EDIT PACIENTE (MOUNTED ON DOCUMENT BODY) */}
            {isPatientModalOpen && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 md:p-6 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-4xl lg:max-w-5xl overflow-hidden border border-slate-100 flex flex-col transform transition-all animate-in zoom-in-95 duration-200 my-auto">
                        {/* Header */}
                        <div className="px-6 py-5 border-b border-sky-100 bg-sky-50/60 flex justify-between items-center shrink-0">
                            <div className="flex items-center gap-3.5">
                                <div className="w-11 h-11 rounded-2xl bg-sky-100 flex items-center justify-center text-sky-600 shadow-inner shrink-0">
                                    <Users className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-slate-900 uppercase tracking-wider">
                                        {editingPatient ? 'Editar Paciente' : 'Novo Paciente'}
                                    </h3>
                                    <p className="text-xs text-sky-700/80 font-bold uppercase tracking-wider mt-0.5">
                                        {editingPatient ? `CPF: ${editingPatient.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}` : 'Preencha os dados do cadastro'}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsPatientModalOpen(false)}
                                className="p-2 hover:bg-slate-200/60 rounded-2xl text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Form Content (Compact Grid 3 Colunas sem rolagem) */}
                        {(() => {
                            const isFieldBlank = (val?: string | null) => {
                                if (!val) return true;
                                const v = val.trim();
                                return !v || v === '(00) 00000-0000' || v === '(00) 000' || v === '000.000.000-00';
                            };

                            const currentFormPatient: Partial<ConsultaPaciente> = {
                                name: patName,
                                cpf: patCpf,
                                birth_date: patBirthDate,
                                phone: patPhone,
                                neighborhood: patNeighborhood,
                                street: patStreet,
                                city: patCity,
                                sus_number: patSusNumber,
                                agente_saude: patAgenteSaude
                            };
                            const missingFormFields = getMissingPatientFields(currentFormPatient);

                            const getFieldClass = (isBlank: boolean, extra = '') => {
                                if (isBlank) {
                                    return `w-full rounded-xl border-2 border-amber-400 bg-amber-50/80 p-2.5 text-slate-900 focus:bg-white focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none transition-all text-xs font-bold placeholder:text-amber-400 ${extra}`;
                                }
                                return `w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all text-xs font-semibold ${extra}`;
                            };

                            return (
                                <form onSubmit={handleSavePatient} className="p-6 md:p-7 space-y-4">
                                    {missingFormFields.length > 0 && (
                                        <div className="p-3.5 bg-amber-50 border border-amber-300 text-amber-900 text-xs font-bold rounded-2xl flex items-center gap-2.5 shadow-sm">
                                            <AlertTriangle className="w-4.5 h-4.5 shrink-0 text-amber-600" />
                                            <div>
                                                <span className="font-black text-amber-950 uppercase tracking-wide">Cadastro Incompleto:</span>{' '}
                                                O(s) seguinte(s) campo(s) precisa(m) ser preenchido(s):{' '}
                                                <span className="underline decoration-amber-400 font-black text-amber-950">{missingFormFields.join(', ')}</span>.
                                            </div>
                                        </div>
                                    )}

                                    {patError && (
                                        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-2xl flex items-center gap-2">
                                            <AlertTriangle className="w-4.5 h-4.5 shrink-0 text-rose-500" />
                                            {patError}
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {/* Linha 1 */}
                                        <div className="md:col-span-2">
                                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 ml-1">
                                                Nome Completo * {isFieldBlank(patName) && <span className="text-amber-600 font-black ml-1 uppercase">(Pendente)</span>}
                                            </label>
                                            <input
                                                type="text"
                                                className={getFieldClass(isFieldBlank(patName), "uppercase")}
                                                placeholder="Ex: Maria Graça"
                                                value={patName}
                                                onChange={(e) => setPatName(e.target.value)}
                                                required
                                            />
                                        </div>

                                        <div className="md:col-span-1">
                                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 ml-1">
                                                Apelido (Opcional)
                                            </label>
                                            <input
                                                type="text"
                                                className={getFieldClass(false, "uppercase")}
                                                placeholder="Ex: Netinho"
                                                value={patNickname}
                                                onChange={(e) => setPatNickname(e.target.value)}
                                            />
                                        </div>

                                        {/* Linha 2 */}
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 ml-1">
                                                CPF * {isFieldBlank(patCpf) && <span className="text-amber-600 font-black ml-1 uppercase">(Pendente)</span>}
                                            </label>
                                            <input
                                                type="text"
                                                className={getFieldClass(isFieldBlank(patCpf), "tracking-wider")}
                                                placeholder="000.000.000-00"
                                                value={patCpf}
                                                onChange={(e) => handleCpfMask(e.target.value)}
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 ml-1">
                                                Data de Nascimento * {isFieldBlank(patBirthDate) && <span className="text-amber-600 font-black ml-1 uppercase">(Pendente)</span>}
                                            </label>
                                            <input
                                                type="date"
                                                className={getFieldClass(isFieldBlank(patBirthDate))}
                                                value={patBirthDate}
                                                onChange={(e) => setPatBirthDate(e.target.value)}
                                                required
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 ml-1">
                                                Telefone {isFieldBlank(patPhone) && <span className="text-amber-600 font-black ml-1 uppercase">(Pendente)</span>}
                                            </label>
                                            <input
                                                type="text"
                                                className={getFieldClass(isFieldBlank(patPhone))}
                                                placeholder="(00) 00000-0000"
                                                value={patPhone}
                                                onChange={(e) => handlePatPhoneChange(e.target.value)}
                                            />
                                        </div>

                                        {/* Linha 3 */}
                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 ml-1">
                                                Bairro {isFieldBlank(patNeighborhood) && <span className="text-amber-600 font-black ml-1 uppercase">(Pendente)</span>}
                                            </label>
                                            <input
                                                type="text"
                                                className={getFieldClass(isFieldBlank(patNeighborhood), "uppercase")}
                                                placeholder="Ex: Centro"
                                                value={patNeighborhood}
                                                onChange={(e) => setPatNeighborhood(e.target.value)}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 ml-1">
                                                Rua / Endereço {isFieldBlank(patStreet) && <span className="text-amber-600 font-black ml-1 uppercase">(Pendente)</span>}
                                            </label>
                                            <input
                                                type="text"
                                                className={getFieldClass(isFieldBlank(patStreet), "uppercase")}
                                                placeholder="Ex: Rua Principal, 10"
                                                value={patStreet}
                                                onChange={(e) => setPatStreet(e.target.value)}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 ml-1">
                                                Cidade * {isFieldBlank(patCity) && <span className="text-amber-600 font-black ml-1 uppercase">(Pendente)</span>}
                                            </label>
                                            <input
                                                type="text"
                                                className={getFieldClass(isFieldBlank(patCity), "uppercase")}
                                                placeholder="Ex: São José do Goiabal - MG"
                                                value={patCity}
                                                onChange={(e) => setPatCity(e.target.value)}
                                                required
                                            />
                                        </div>

                                        {/* Linha 4 */}
                                        <div className="md:col-span-1">
                                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 ml-1">
                                                Número do SUS {isFieldBlank(patSusNumber) && <span className="text-amber-600 font-black ml-1 uppercase">(Pendente)</span>}
                                            </label>
                                            <input
                                                type="text"
                                                className={getFieldClass(isFieldBlank(patSusNumber), "tracking-wider")}
                                                placeholder="000 0000 0000 0000"
                                                value={patSusNumber}
                                                onChange={(e) => setPatSusNumber(e.target.value.replace(/\D/g, '').slice(0, 15))}
                                            />
                                        </div>

                                        <div className="md:col-span-2">
                                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 ml-1">
                                                Agente de Saúde (ACS) {isFieldBlank(patAgenteSaude) && <span className="text-amber-600 font-black ml-1 uppercase">(Pendente)</span>}
                                            </label>
                                            <div className="relative">
                                                <select
                                                    className={getFieldClass(isFieldBlank(patAgenteSaude), "pr-8 uppercase cursor-pointer appearance-none")}
                                                    value={patAgenteSaude}
                                                    onChange={(e) => setPatAgenteSaude(e.target.value)}
                                                >
                                                    <option value="">-- SELECIONE O AGENTE DE SAÚDE (OPCIONAL) --</option>
                                                    {AGENTES_DE_SAUDE.map((agente) => (
                                                        <option key={agente} value={agente.toUpperCase()}>
                                                            {agente.toUpperCase()}
                                                        </option>
                                                    ))}
                                                </select>
                                                <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Modal Footer */}
                                    <div className="pt-4 border-t border-slate-100 flex justify-end gap-3 shrink-0 rounded-b-2xl">
                                        <button
                                            type="button"
                                            onClick={() => setIsPatientModalOpen(false)}
                                            className="px-4 py-2.5 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-extrabold rounded-xl text-xs uppercase tracking-wider transition-all cursor-pointer"
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-extrabold rounded-xl shadow-lg shadow-sky-600/20 active:scale-95 transition-all text-xs uppercase tracking-wider flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                        >
                                            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                            Salvar Alterações
                                        </button>
                                    </div>
                                </form>
                            );
                        })()}
                    </div>
                </div>,
                document.body
            )}

            {/* SIDE DRAWER: HISTÓRICO COMPLETO DO PACIENTE (MOUNTED ON DOCUMENT BODY) */}
            {isHistoryOpen && selectedPatient && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[99999] flex justify-end">
                    <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm animate-fade-in" onClick={() => setIsHistoryOpen(false)} />
                    <div className="relative z-10 w-full max-w-lg h-full bg-white border-l border-slate-200/80 shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="font-extrabold text-slate-900 text-base">Histórico Clínico (Exames/Consultas)</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{formatPatientName(selectedPatient)}</p>
                            </div>
                            <button onClick={() => setIsHistoryOpen(false)} className="p-2 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-700 transition-colors cursor-pointer">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-5 space-y-3 custom-scrollbar">
                            {patientHistory.length > 0 ? (
                                patientHistory.map(hist => (
                                    <div key={hist.id} className="p-4 bg-slate-50/50 border border-slate-100 rounded-2xl space-y-2.5">
                                        <div className="flex items-center justify-between">
                                            <span className="font-extrabold text-xs text-slate-800">{hist.procedimento?.name}</span>
                                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider border ${
                                                hist.status === 'Solicitado'
                                                ? 'bg-sky-50 text-sky-700 border-sky-100'
                                                : hist.status === 'Agendado' 
                                                ? 'bg-indigo-50 text-indigo-700 border-indigo-100' 
                                                : hist.status === 'Realizado' 
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                                : hist.status === 'Não Realizado'
                                                ? 'bg-slate-100 text-slate-600 border-slate-200'
                                                : hist.status === 'Fila de espera'
                                                ? 'bg-amber-50 text-amber-700 border-amber-100'
                                                : hist.status === 'Aguardando Data'
                                                ? 'bg-violet-50 text-violet-700 border-violet-100'
                                                : hist.status === 'Retorno'
                                                ? 'bg-teal-50 text-teal-700 border-teal-100'
                                                : 'bg-rose-50 text-rose-700 border-rose-100'
                                            }`}>
                                                {hist.status}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                            <span>Data: {new Date(hist.appointment_date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                                            <span>Qtd: {hist.quantity || 1}</span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center text-xs font-bold text-slate-400 py-12">Nenhum agendamento registrado para este paciente.</div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
