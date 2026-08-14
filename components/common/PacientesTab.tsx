import React, { useState, useEffect } from 'react';
import { ConsultaPaciente, ConsultaAgendamento } from '../../types';
import { Search, Plus, Edit2, Trash2, X, AlertTriangle, Loader2 } from 'lucide-react';
import * as db from '../../services/consultasService';

export const formatPatientName = (patient?: ConsultaPaciente | null) => {
    if (!patient) return '';
    return patient.nickname ? `${patient.name} (${patient.nickname})` : patient.name;
};

export const PacientesTab: React.FC = () => {
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
    const [patError, setPatError] = useState('');

    const fetchPatients = async () => {
        setLoading(true);
        try {
            const data = await db.getPacientes();
            setPatients(data);
        } catch (error) {
            console.error('Error fetching patients:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPatients();

        const handleRealtimeChange = () => {
            fetchPatients();
        };

        window.addEventListener('consultas-pacientes-changed', handleRealtimeChange);
        window.addEventListener('consultas-agendamentos-changed', handleRealtimeChange);

        return () => {
            window.removeEventListener('consultas-pacientes-changed', handleRealtimeChange);
            window.removeEventListener('consultas-agendamentos-changed', handleRealtimeChange);
        };
    }, []);

    // Patient Form Phone Mask
    const handlePatPhoneChange = (val: string) => {
        const clean = val.replace(/\D/g, '');
        let formatted = '';
        if (clean.length <= 2) {
            formatted = clean;
        } else if (clean.length <= 6) {
            formatted = `(${clean.slice(0, 2)}) ${clean.slice(2)}`;
        } else if (clean.length <= 10) {
            formatted = `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
        } else {
            formatted = `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7, 11)}`;
        }
        setPatPhone(formatted);
    };

    // Patient Form CPF Mask
    const handleCpfMask = (val: string) => {
        const clean = val.replace(/\D/g, '');
        let formatted = '';
        if (clean.length <= 3) {
            formatted = clean;
        } else if (clean.length <= 6) {
            formatted = `${clean.slice(0, 3)}.${clean.slice(3)}`;
        } else if (clean.length <= 9) {
            formatted = `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6)}`;
        } else {
            formatted = `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9, 11)}`;
        }
        setPatCpf(formatted);
    };

    // Patient Form validation & save
    const handleSavePatient = async (e: React.FormEvent) => {
        e.preventDefault();
        setPatError('');

        if (!patName.trim()) {
            setPatError('Nome completo é obrigatório.');
            return;
        }
        if (patCpf.replace(/\D/g, '').length !== 11) {
            setPatError('CPF inválido (deve conter 11 dígitos).');
            return;
        }
        if (!patBirthDate) {
            setPatError('Data de nascimento é obrigatória.');
            return;
        }

        setLoading(true);
        try {
            if (editingPatient) {
                await db.updatePaciente(editingPatient.id, {
                    name: patName,
                    nickname: patNickname.trim() || null,
                    cpf: patCpf,
                    birth_date: patBirthDate,
                    phone: patPhone.trim() || null,
                    neighborhood: patNeighborhood.trim() || null,
                    street: patStreet.trim() || null,
                    city: patCity.trim() || null,
                    sus_number: patSusNumber.trim() || null
                });
            } else {
                await db.createPaciente({
                    name: patName,
                    nickname: patNickname.trim() || null,
                    cpf: patCpf,
                    birth_date: patBirthDate,
                    phone: patPhone.trim() || null,
                    neighborhood: patNeighborhood.trim() || null,
                    street: patStreet.trim() || null,
                    city: patCity.trim() || null,
                    sus_number: patSusNumber.trim() || null
                });
            }
            setIsPatientModalOpen(false);
            fetchPatients();
        } catch (err: any) {
            setPatError(err.message || 'Erro ao salvar paciente.');
        } finally {
            setLoading(false);
        }
    };

    const handleDeletePatient = async (patientId: string) => {
        if (!window.confirm('Deseja realmente excluir este paciente? Esta ação não pode ser desfeita.')) return;
        setLoading(true);
        try {
            await db.deletePaciente(patientId);
            await fetchPatients();
        } catch (err: any) {
            console.error('Error deleting patient:', err);
            alert(err.message || 'Erro ao deletar paciente.');
        } finally {
            setLoading(false);
        }
    };

    // Patient History Drawer
    const handleOpenHistory = async (patient: ConsultaPaciente) => {
        setSelectedPatient(patient);
        const history = await db.getPacienteHistory(patient.id);
        setPatientHistory(history);
        setIsHistoryOpen(true);
    };

    // Open Patient Modal (Add or Edit)
    const handleOpenPatientModal = (patient: ConsultaPaciente | null = null) => {
        setEditingPatient(patient);
        if (patient) {
            setPatName(patient.name);
            setPatNickname(patient.nickname || '');
            // Format CPF for displaying
            const rawCpf = patient.cpf;
            let formatted = rawCpf;
            if (rawCpf.length === 11) {
                formatted = rawCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
            }
            setPatCpf(formatted);
            setPatBirthDate(patient.birth_date);
            setPatPhone(patient.phone || '');
            setPatNeighborhood(patient.neighborhood || '');
            setPatStreet(patient.street || '');
            setPatCity(patient.city || 'SÃO JOSÉ DO GOIABAL -MG');
            setPatSusNumber(patient.sus_number || '');
        } else {
            setPatName('');
            setPatNickname('');
            setPatCpf('');
            setPatBirthDate('');
            setPatPhone('');
            setPatNeighborhood('');
            setPatStreet('');
            setPatCity('SÃO JOSÉ DO GOIABAL -MG');
            setPatSusNumber('');
        }
        setPatError('');
        setIsPatientModalOpen(true);
    };

    const filteredPatients = patients.filter(p => 
        p.name.toLowerCase().includes(patientSearch.toLowerCase()) || 
        p.cpf.includes(patientSearch.replace(/\D/g, '')) ||
        (p.sus_number || '').includes(patientSearch.replace(/\D/g, ''))
    );

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:max-w-md">
                    <input
                        type="text"
                        placeholder="Buscar paciente por nome ou CPF..."
                        className="w-full bg-white border border-slate-300 rounded-xl pl-10 pr-4 py-2.5 text-xs font-semibold placeholder:text-slate-500 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/15 transition-all text-slate-900 shadow-sm"
                        value={patientSearch}
                        onChange={(e) => setPatientSearch(e.target.value)}
                    />
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
                </div>
                <button
                    onClick={() => handleOpenPatientModal()}
                    className="w-full sm:w-auto px-4 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-extrabold rounded-xl shadow-md hover:shadow-sky-500/10 active:scale-95 transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-1.5"
                >
                    <Plus className="w-4 h-4" /> Novo Paciente
                </button>
            </div>

            {filteredPatients.length > 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                <th className="p-4">Nome</th>
                                <th className="p-4">CPF</th>
                                <th className="p-4">Nascimento</th>
                                <th className="p-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                            {filteredPatients.map(p => (
                                <tr key={p.id} className="hover:bg-slate-50/20">
                                    <td className="p-4 font-extrabold text-slate-900">{formatPatientName(p)}</td>
                                    <td className="p-4">{p.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}</td>
                                    <td className="p-4">{new Date(p.birth_date + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
                                    <td className="p-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleOpenHistory(p)}
                                                className="px-2.5 py-1 text-slate-500 hover:text-sky-600 hover:bg-sky-50 border border-slate-200 rounded-lg text-[10px] uppercase font-bold transition-all"
                                            >
                                                Histórico
                                            </button>
                                            <button
                                                onClick={() => handleOpenPatientModal(p)}
                                                className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-slate-100 rounded-lg transition-all"
                                                title="Editar Dados"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDeletePatient(p.id)}
                                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
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
                <div className="text-center text-xs font-bold text-slate-400 py-12">Nenhum paciente cadastrado.</div>
            )}

            {/* MODAL: ADD/EDIT PACIENTE */}
            {isPatientModalOpen && (
                <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                            <h3 className="text-base font-black text-slate-800 uppercase tracking-wider">
                                {editingPatient ? 'Editar Paciente' : 'Novo Paciente'}
                            </h3>
                            <button onClick={() => setIsPatientModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-700 transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={handleSavePatient} className="p-6 space-y-4 overflow-y-auto custom-scrollbar flex-1">
                            {patError && (
                                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold rounded-xl flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                                    {patError}
                                </div>
                            )}
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Nome Completo</label>
                                <input
                                    type="text"
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all text-xs font-semibold"
                                    placeholder="Ex: Maria Graça"
                                    value={patName}
                                    onChange={(e) => setPatName(e.target.value)}
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Apelido</label>
                                <input
                                    type="text"
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all text-xs font-semibold"
                                    placeholder="Ex: Netinho"
                                    value={patNickname}
                                    onChange={(e) => setPatNickname(e.target.value)}
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">CPF</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all text-xs font-bold tracking-wider"
                                        placeholder="000.000.000-00"
                                        value={patCpf}
                                        onChange={(e) => handleCpfMask(e.target.value)}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Nascimento</label>
                                    <input
                                        type="date"
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all text-xs font-semibold"
                                        value={patBirthDate}
                                        onChange={(e) => setPatBirthDate(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Telefone</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all text-xs font-semibold"
                                        placeholder="(00) 00000-0000"
                                        value={patPhone}
                                        onChange={(e) => handlePatPhoneChange(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Bairro</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all text-xs font-semibold"
                                        placeholder="Ex: Centro"
                                        value={patNeighborhood}
                                        onChange={(e) => setPatNeighborhood(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Rua</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all text-xs font-semibold"
                                        placeholder="Ex: Rua Principal, 10"
                                        value={patStreet}
                                        onChange={(e) => setPatStreet(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Cidade</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all text-xs font-semibold"
                                        placeholder="Ex: São José do Goiabal - MG"
                                        value={patCity}
                                        onChange={(e) => setPatCity(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Número do SUS (Opcional)</label>
                                <input
                                    type="text"
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 outline-none transition-all text-xs font-bold tracking-wider"
                                    placeholder="000 0000 0000 0000"
                                    value={patSusNumber}
                                    onChange={(e) => setPatSusNumber(e.target.value.replace(/\D/g, '').slice(0, 15))}
                                />
                            </div>
                            <div className="pt-4 border-t border-slate-50 flex justify-end gap-3 shrink-0">
                                <button
                                    type="button"
                                    onClick={() => setIsPatientModalOpen(false)}
                                    className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-extrabold rounded-xl text-xs uppercase tracking-wider"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-extrabold rounded-xl shadow-lg active:scale-95 transition-all text-xs uppercase tracking-wider flex items-center gap-1.5"
                                >
                                    {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                    Salvar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* SIDE DRAWER: HISTÓRICO COMPLETO DO PACIENTE */}
            {isHistoryOpen && selectedPatient && (
                <div className="fixed inset-0 z-[999] flex justify-end">
                    <div className="absolute inset-0 bg-slate-900/25 backdrop-blur-[2px] animate-fade-in" onClick={() => setIsHistoryOpen(false)} />
                    <div className="relative z-10 w-full max-w-lg h-full bg-white border-l border-slate-200/80 shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h3 className="font-extrabold text-slate-900 text-base">Histórico Clínico (Exames/Consultas)</h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{formatPatientName(selectedPatient)}</p>
                            </div>
                            <button onClick={() => setIsHistoryOpen(false)} className="p-2 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-700 transition-colors">
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
                </div>
            )}
        </div>
    );
};
