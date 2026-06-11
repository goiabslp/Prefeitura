import React, { useState, useEffect, useMemo } from 'react';
import { User, FarmaciaMedicamento, FarmaciaMovimentacao, ConsultaPaciente } from '../../types';
import { ArrowLeft, User as UserIcon, Calendar, ClipboardList, CheckCircle2, AlertTriangle, Search, Loader2, History, X } from 'lucide-react';
import * as db from '../../services/farmaciaService';
import { getPacientes, createPaciente } from '../../services/consultasService';

interface RetirarScreenProps {
    currentUser: User;
    onBack: () => void;
    onNavigate: (view: string) => void;
    appState: any;
}

export const RetirarScreen: React.FC<RetirarScreenProps> = ({
    currentUser,
    onBack,
    onNavigate
}) => {
    // DB Data states
    const [medicamentos, setMedicamentos] = useState<FarmaciaMedicamento[]>([]);
    const [pacientes, setPacientes] = useState<ConsultaPaciente[]>([]);
    const [recentWithdrawals, setRecentWithdrawals] = useState<FarmaciaMovimentacao[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Form inputs
    const [patientName, setPatientName] = useState('');
    const [patientCpf, setPatientCpf] = useState('');
    const [isPatientUnlocked, setIsPatientUnlocked] = useState(false);
    const [selectedMedId, setSelectedMedId] = useState('');
    const [quantity, setQuantity] = useState('');
    const [withdrawalDate, setWithdrawalDate] = useState(new Date().toISOString().split('T')[0]);
    const [observacoes, setObservacoes] = useState('');

    // Autocomplete dropdown UI states
    const [showPatientDropdown, setShowPatientDropdown] = useState(false);
    const [patientSearchQuery, setPatientSearchQuery] = useState('');
    const [medSearchQuery, setMedSearchQuery] = useState('');
    const [showMedDropdown, setShowMedDropdown] = useState(false);
    const [recentSearchQuery, setRecentSearchQuery] = useState('');
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

    // Patient registration UI states
    const [isRegModalOpen, setIsRegModalOpen] = useState(false);
    const [pendingCpf, setPendingCpf] = useState('');
    const [newPatientName, setNewPatientName] = useState('');
    const [newPatientBirthDate, setNewPatientBirthDate] = useState('');
    const [registering, setRegistering] = useState(false);

    // Success notification modal state
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);

    // Load data
    const loadData = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const [medData, pacData, movData] = await Promise.all([
                db.getMedicamentos(),
                getPacientes().catch(() => []), // fallback if it fails
                db.getMovimentacoes({ tipo: 'Saída' })
            ]);
            setMedicamentos(medData);
            setPacientes(pacData);
            setRecentWithdrawals(movData);
        } catch (error) {
            console.error('[RetirarScreen] Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();

        const handleMedChange = () => loadData(true);
        const handleMovChange = () => loadData(true);

        window.addEventListener('farmacia-medicamentos-changed', handleMedChange);
        window.addEventListener('farmacia-movimentacoes-changed', handleMovChange);

        return () => {
            window.removeEventListener('farmacia-medicamentos-changed', handleMedChange);
            window.removeEventListener('farmacia-movimentacoes-changed', handleMovChange);
        };
    }, []);

    // Filter patients suggestion list
    const patientSuggestions = useMemo(() => {
        if (!patientSearchQuery) return [];
        const query = patientSearchQuery.toLowerCase();
        return pacientes.filter(p => 
            p.name.toLowerCase().includes(query) || 
            p.cpf.includes(query.replace(/\D/g, ''))
        ).slice(0, 5);
    }, [pacientes, patientSearchQuery]);

    // Filter medicine suggestion list
    const medSuggestions = useMemo(() => {
        if (!medSearchQuery) {
            // Show first 8 available medicines if no query entered yet
            return medicamentos.filter(m => m.quantidade > 0).slice(0, 8);
        }
        const query = medSearchQuery.toLowerCase();
        return medicamentos.filter(m => 
            m.quantidade > 0 && (
                m.nome.toLowerCase().includes(query) || 
                (m.dosagem || '').toLowerCase().includes(query) || 
                m.lote.toLowerCase().includes(query) ||
                m.categoria.toLowerCase().includes(query)
            )
        ).slice(0, 8);
    }, [medicamentos, medSearchQuery]);

    // Active selected medicine batch detail

    // Active selected medicine batch detail
    const selectedMed = useMemo(() => {
        return medicamentos.find(m => m.id === selectedMedId);
    }, [medicamentos, selectedMedId]);

    // Filter withdrawals for the active patient
    const patientWithdrawals = useMemo(() => {
        const nameQuery = patientName.trim().toLowerCase();
        const cpfQuery = patientCpf.replace(/\D/g, '');

        return recentWithdrawals.filter(w => {
            const matchesCpf = cpfQuery ? (w.paciente_cpf || '').includes(cpfQuery) : false;
            const matchesName = nameQuery ? (w.paciente_nome || '').toLowerCase().includes(nameQuery) : false;

            if (cpfQuery || nameQuery) {
                return matchesCpf || matchesName;
            }
            return true; // show all if empty
        });
    }, [recentWithdrawals, patientName, patientCpf]);

    // Mask CPF input helper
    const handleCpfChange = (val: string) => {
        let clean = val.replace(/\D/g, '');
        if (clean.length > 11) clean = clean.slice(0, 11);

        let formatted = '';
        if (clean.length > 0) formatted += clean.slice(0, 3);
        if (clean.length > 3) formatted += '.' + clean.slice(3, 6);
        if (clean.length > 6) formatted += '.' + clean.slice(6, 9);
        if (clean.length > 9) formatted += '-' + clean.slice(9, 11);
        setPatientCpf(formatted);

        // If CPF is fully typed (11 digits), check if patient is registered
        if (clean.length === 11) {
            const found = pacientes.find(p => p.cpf.replace(/\D/g, '') === clean);
            if (found) {
                setPatientName(found.name);
                setIsPatientUnlocked(true);
            } else {
                setPatientName('');
                setIsPatientUnlocked(false);
                setPendingCpf(formatted);
                setIsRegModalOpen(true);
            }
        } else {
            setPatientName('');
            setIsPatientUnlocked(false);
        }
    };

    // Confirm withdrawal / checkout handler
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!patientName || !patientCpf || !selectedMedId || !quantity || !withdrawalDate) {
            alert('Por favor, preencha todos os campos obrigatórios.');
            return;
        }

        const qtyNum = parseInt(quantity, 10);
        if (isNaN(qtyNum) || qtyNum <= 0) {
            alert('A quantidade deve ser um número inteiro maior que zero.');
            return;
        }

        if (!selectedMed) {
            alert('Selecione um medicamento válido.');
            return;
        }

        if (selectedMed.quantidade < qtyNum) {
            alert(`Estoque insuficiente. Quantidade disponível: ${selectedMed.quantidade} ${selectedMed.unidade}`);
            return;
        }

        setSaving(true);

        // --- OPTIMISTIC UI UPDATE ---
        const originalMedState = [...medicamentos];
        const originalRecentMovsState = [...recentWithdrawals];

        // Deduct quantity locally
        setMedicamentos(prev => prev.map(m => 
            m.id === selectedMedId ? { ...m, quantidade: m.quantidade - qtyNum } : m
        ));

        // Create mock local movement log
        const optimisticLog: FarmaciaMovimentacao = {
            id: 'optimistic-id-' + Date.now(),
            medicamento_id: selectedMedId,
            tipo: 'Saída',
            quantidade: qtyNum,
            medicamento_nome: selectedMed.nome,
            medicamento_categoria: selectedMed.categoria,
            medicamento_tipo: selectedMed.tipo,
            medicamento_dosagem: selectedMed.dosagem,
            lote: selectedMed.lote,
            validade: selectedMed.validade,
            paciente_nome: patientName,
            paciente_cpf: patientCpf.replace(/\D/g, ''),
            responsavel_nome: currentUser.name,
            responsavel_id: currentUser.id,
            data: new Date(withdrawalDate + 'T12:00:00').toISOString(),
            observacoes: observacoes
        };
        setRecentWithdrawals(prev => [optimisticLog, ...prev]);

        // Clear form fields immediately for crisp UX
        setQuantity('');
        setObservacoes('');
        setSelectedMedId('');
        setMedSearchQuery('');
        setPatientName('');
        setPatientCpf('');
        setIsPatientUnlocked(false);

        try {
            await db.registrarMovimentacao({
                medicamento_id: selectedMedId,
                tipo: 'Saída',
                quantidade: qtyNum,
                medicamento_nome: selectedMed.nome,
                medicamento_categoria: selectedMed.categoria,
                medicamento_tipo: selectedMed.tipo,
                medicamento_dosagem: selectedMed.dosagem,
                lote: selectedMed.lote,
                validade: selectedMed.validade,
                paciente_nome: patientName,
                paciente_cpf: patientCpf.replace(/\D/g, ''),
                responsavel_nome: currentUser.name,
                responsavel_id: currentUser.id,
                observacoes: observacoes
            });

            // Trigger visual refresh of all local caches
            await loadData(true);
            setIsSuccessModalOpen(true);
        } catch (err: any) {
            // Revert optimistic updates on error
            setMedicamentos(originalMedState);
            setRecentWithdrawals(originalRecentMovsState);
            alert(err.message || 'Erro ao registrar a retirada.');
        } finally {
            setSaving(false);
        }
    };

    const filteredRecentWithdrawals = recentWithdrawals.filter(w => {
        const query = recentSearchQuery.toLowerCase();
        return w.paciente_nome?.toLowerCase().includes(query) || 
               w.medicamento_nome.toLowerCase().includes(query);
    });

    const formatDateBr = (d: string) => {
        if (!d) return '';
        const parts = d.split('T')[0].split('-');
        if (parts.length !== 3) return d;
        const [year, month, day] = parts;
        return `${day}/${month}/${year}`;
    };

    return (
        <div className="w-full max-w-none mx-auto min-h-0 overflow-hidden flex flex-col flex-1">
            {/* Ficha de liberação */}
            <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-md flex flex-col w-full min-h-0 overflow-hidden flex-1 justify-between">
                <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3 shrink-0">
                    <div className="flex items-center gap-2">
                        <ClipboardList className="w-5 h-5 text-pink-600" />
                        <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-tight">Nova Dispensação</h3>
                    </div>
                    <button
                        type="button"
                        onClick={() => setIsHistoryModalOpen(true)}
                        className="px-3.5 py-2 bg-pink-50 hover:bg-pink-100 text-pink-700 font-black text-[9px] uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 border border-pink-200/40 shadow-sm"
                    >
                        <History className="w-3.5 h-3.5" />
                        Ver Histórico
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex-1 flex flex-col justify-between gap-4 min-h-0 overflow-hidden">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0 overflow-y-auto md:overflow-visible pr-1 custom-scrollbar">
                        {/* Column 1 */}
                        <div className="space-y-4">
                            {/* CPF */}
                            <div>
                                <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1 ml-1">CPF do Paciente</label>
                                <input
                                    type="text"
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 px-4 text-[11px] text-slate-900 focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-mono font-bold"
                                    placeholder="000.000.000-00"
                                    value={patientCpf}
                                    onChange={(e) => handleCpfChange(e.target.value)}
                                    required
                                />
                            </div>

                            {/* Patient search & name */}
                            <div className="relative">
                                <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1 ml-1">Paciente</label>
                                <input
                                    type="text"
                                    className={`w-full rounded-xl border border-slate-200 py-3.5 px-4 text-[11px] text-slate-900 outline-none transition-all font-semibold uppercase ${
                                        !isPatientUnlocked 
                                            ? 'bg-slate-100 opacity-60 cursor-not-allowed' 
                                            : 'bg-slate-50 focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10'
                                    }`}
                                    placeholder={!isPatientUnlocked ? "Digite o CPF primeiro" : "Nome Completo do Paciente"}
                                    value={patientName}
                                    onChange={(e) => {
                                        setPatientName(e.target.value.toUpperCase());
                                        setPatientSearchQuery(e.target.value.toUpperCase());
                                        setShowPatientDropdown(true);
                                    }}
                                    onFocus={() => setShowPatientDropdown(true)}
                                    onBlur={() => setTimeout(() => setShowPatientDropdown(false), 200)}
                                    disabled={!isPatientUnlocked}
                                    required
                                />

                                {/* Autocomplete suggestion box */}
                                {showPatientDropdown && patientSuggestions.length > 0 && (
                                    <div className="absolute left-0 top-full mt-1 w-full bg-white rounded-xl shadow-xl border border-slate-100 max-h-48 overflow-y-auto z-50 custom-scrollbar">
                                        {patientSuggestions.map(p => (
                                            <button
                                                key={p.id}
                                                type="button"
                                                onMouseDown={() => {
                                                    setPatientName(p.name);
                                                    handleCpfChange(p.cpf);
                                                    setShowPatientDropdown(false);
                                                }}
                                                className="w-full text-left px-4 py-2.5 hover:bg-pink-50 text-slate-700 text-[11px] font-semibold border-b border-slate-50 last:border-0 flex items-center justify-between"
                                            >
                                                <span>{p.name}</span>
                                                <span className="text-[9px] text-slate-400 font-mono">
                                                    {p.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Medicamento Batch selection */}
                            <div className="relative">
                                <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1 ml-1">Medicamento (Lote/Categoria)</label>
                                <input
                                    type="text"
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 px-4 text-[11px] text-slate-900 focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-semibold uppercase"
                                    placeholder="Digite nome, dosagem, lote ou categoria..."
                                    value={medSearchQuery}
                                    onChange={(e) => {
                                        setMedSearchQuery(e.target.value.toUpperCase());
                                        setSelectedMedId(''); // clear selection if user types
                                        setShowMedDropdown(true);
                                    }}
                                    onFocus={() => setShowMedDropdown(true)}
                                    onBlur={() => setTimeout(() => setShowMedDropdown(false), 200)}
                                    required
                                />

                                {/* Autocomplete suggestion box */}
                                {showMedDropdown && medSuggestions.length > 0 && (
                                    <div className="absolute left-0 top-full mt-1 w-full bg-white rounded-xl shadow-xl border border-slate-100 max-h-48 overflow-y-auto z-50 custom-scrollbar">
                                        {medSuggestions.map(med => (
                                            <button
                                                key={med.id}
                                                type="button"
                                                onMouseDown={() => {
                                                    const medLabel = `${med.nome.toUpperCase()} ${med.dosagem ? `(${med.dosagem})` : ''} - Lote: ${med.lote} (Disp: ${med.quantidade} ${med.unidade})`;
                                                    setSelectedMedId(med.id);
                                                    setMedSearchQuery(medLabel);
                                                    setShowMedDropdown(false);
                                                }}
                                                className="w-full text-left px-4 py-2.5 hover:bg-pink-50 text-slate-700 text-[11px] font-semibold border-b border-slate-50 last:border-0 flex flex-col gap-0.5"
                                            >
                                                <div className="flex justify-between items-center w-full">
                                                    <span className="font-extrabold uppercase text-slate-800">
                                                        {med.nome} {med.dosagem ? `(${med.dosagem})` : ''}
                                                    </span>
                                                    <span className="text-[9px] font-mono text-slate-400 font-bold">
                                                        Lote: {med.lote}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center w-full text-[9px] text-slate-400 mt-0.5">
                                                    <span className="uppercase tracking-wider">
                                                        {med.categoria} {med.tipo ? `[${med.tipo}]` : ''}
                                                    </span>
                                                    <span className="font-black text-pink-600">
                                                        Disp: {med.quantidade} {med.unidade}
                                                    </span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Quantidade */}
                            <div>
                                <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1 ml-1">Quantidade</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 pl-4 pr-16 text-[11px] text-slate-900 focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-bold"
                                        placeholder="Qtde"
                                        value={quantity}
                                        onChange={(e) => setQuantity(e.target.value)}
                                        min="1"
                                        max={selectedMed ? selectedMed.quantidade : undefined}
                                        required
                                    />
                                    {selectedMed && (
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400">
                                            {selectedMed.unidade}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Column 2 */}
                        <div className="space-y-4 flex flex-col justify-between">
                            {/* Data */}
                            <div>
                                <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1 ml-1">Data</label>
                                <input
                                    type="date"
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 px-4 text-[11px] text-slate-900 focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-semibold cursor-pointer"
                                    value={withdrawalDate}
                                    onChange={(e) => setWithdrawalDate(e.target.value)}
                                    required
                                />
                            </div>

                            {/* Observações */}
                            <div className="flex-1 flex flex-col">
                                <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1 ml-1">Observações / Receita</label>
                                <textarea
                                    className="w-full flex-1 rounded-xl border border-slate-200 bg-slate-50 py-3.5 px-4 text-[11px] text-slate-900 focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-semibold min-h-[60px] md:min-h-0"
                                    placeholder="Ex: Receita do Dr. João, validade 6 meses..."
                                    value={observacoes}
                                    onChange={(e) => setObservacoes(e.target.value)}
                                />
                            </div>

                            {/* Responsável read-only */}
                            <div>
                                <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1 ml-1">Responsável pela Entrega</label>
                                <div className="w-full rounded-xl border border-slate-200 bg-slate-100 py-3.5 px-4 text-[11px] text-slate-500 font-bold flex items-center gap-2 shadow-inner">
                                    <UserIcon className="w-4 h-4 text-slate-400" />
                                    {currentUser.name}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full py-3.5 rounded-xl bg-pink-600 hover:bg-pink-700 text-white font-black text-[11px] uppercase tracking-widest transition-all shadow-md hover:shadow-lg active:scale-98 flex items-center justify-center gap-2 shrink-0"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Processando...
                            </>
                        ) : (
                            'Confirmar Retirada'
                        )}
                    </button>
                </form>
            </div>

            {/* PATIENT HISTORY MODAL */}
            {isHistoryModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[85vh] overflow-hidden border border-slate-200/50 flex flex-col">
                        {/* Modal Header */}
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                            <div>
                                <h3 className="font-extrabold text-slate-800 uppercase text-[11px] tracking-wider">
                                    Histórico de Dispensações
                                </h3>
                                {patientName ? (
                                    <p className="text-[9px] text-pink-600 font-bold uppercase mt-0.5">
                                        Filtrado por: {patientName} {patientCpf && `(${patientCpf})`}
                                    </p>
                                ) : (
                                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">
                                        Digite o nome do paciente no formulário para filtrar
                                    </p>
                                )}
                            </div>
                            <button
                                onClick={() => setIsHistoryModalOpen(false)}
                                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="flex-1 overflow-auto p-6 min-h-0 custom-scrollbar">
                            {patientWithdrawals.length > 0 ? (
                                <div className="overflow-x-auto border border-slate-150 rounded-2xl">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-100 text-[8px] font-black text-slate-400 uppercase tracking-wider">
                                                <th className="p-3">Data</th>
                                                <th className="p-3">Paciente / CPF</th>
                                                <th className="p-3">Medicamento / Categoria</th>
                                                <th className="p-3">Lote</th>
                                                <th className="p-3 text-center">Quantidade</th>
                                                <th className="p-3">Entregue Por</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-[11px] font-semibold text-slate-700">
                                            {patientWithdrawals.map(w => (
                                                <tr key={w.id} className="hover:bg-slate-50/30 transition-colors">
                                                    <td className="p-3 text-slate-500 font-mono">
                                                        {formatDateBr(w.data)}
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="font-extrabold text-slate-850 uppercase">{w.paciente_nome}</div>
                                                        <div className="text-[9px] text-slate-400 font-mono font-bold mt-0.5">
                                                            CPF: {w.paciente_cpf?.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}
                                                        </div>
                                                    </td>
                                                    <td className="p-3">
                                                        <div className="font-bold text-slate-800 uppercase">{w.medicamento_nome}</div>
                                                        <div className="flex flex-wrap gap-1 mt-1">
                                                            <span className="inline-block px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded bg-pink-50 text-pink-600">
                                                                {w.medicamento_categoria}
                                                            </span>
                                                            {w.medicamento_dosagem && (
                                                                <span className="inline-block px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded bg-pink-50 text-pink-700 border border-pink-100">
                                                                    {w.medicamento_dosagem}
                                                                </span>
                                                            )}
                                                            {w.medicamento_tipo && (
                                                                <span className="inline-block px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded bg-slate-100 text-slate-500">
                                                                    {w.medicamento_tipo}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="p-3 font-mono font-bold text-slate-600">
                                                        {w.lote}
                                                    </td>
                                                    <td className="p-3 text-center text-slate-900 font-black">
                                                        {w.quantidade}
                                                    </td>
                                                    <td className="p-3 text-slate-500 font-bold">
                                                        {w.responsavel_nome}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                                    <ClipboardList className="w-12 h-12 mb-2 opacity-20 text-slate-500" />
                                    <h4 className="text-xs font-extrabold text-slate-700">Nenhum registro encontrado</h4>
                                    <p className="text-[9px] text-slate-500 text-center mt-0.5 font-medium">
                                        {patientName ? `Não encontramos retiradas para o paciente "${patientName}".` : "Nenhum histórico disponível."}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* NEW PATIENT REGISTRATION MODAL */}
            {isRegModalOpen && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200/50 flex flex-col">
                        {/* Header */}
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                            <div>
                                <h3 className="font-extrabold text-slate-800 uppercase text-xs tracking-wider">
                                    Cadastrar Novo Paciente
                                </h3>
                                <p className="text-[9px] text-pink-600 font-bold uppercase mt-0.5">
                                    CPF {pendingCpf} não cadastrado
                                </p>
                            </div>
                            <button
                                onClick={() => {
                                    setIsRegModalOpen(false);
                                    setPatientCpf('');
                                }}
                                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Form Body */}
                        <form
                            onSubmit={async (e) => {
                                e.preventDefault();
                                if (!newPatientName || !pendingCpf || !newPatientBirthDate) {
                                    alert('Por favor, preencha todos os campos obrigatórios.');
                                    return;
                                }
                                setRegistering(true);
                                try {
                                    const created = await createPaciente({
                                        name: newPatientName,
                                        cpf: pendingCpf.replace(/\D/g, ''),
                                        birth_date: newPatientBirthDate
                                    });
                                    if (created) {
                                        // Update local patients state list
                                        setPacientes(prev => [...prev, created]);
                                        // Set values to form and unlock
                                        setPatientName(created.name);
                                        setPatientCpf(pendingCpf);
                                        setIsPatientUnlocked(true);
                                        // Clear registration states
                                        setNewPatientName('');
                                        setNewPatientBirthDate('');
                                        setIsRegModalOpen(false);
                                    } else {
                                        alert('Erro ao cadastrar paciente.');
                                    }
                                } catch (err: any) {
                                    alert(err.message || 'Erro ao cadastrar paciente.');
                                } finally {
                                    setRegistering(false);
                                }
                            }}
                            className="p-6 space-y-4 text-left"
                        >
                            {/* CPF (read-only) */}
                            <div>
                                <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1 ml-1">CPF do Paciente</label>
                                <input
                                    type="text"
                                    className="w-full rounded-xl border border-slate-200 bg-slate-100 py-3.5 px-4 text-[11px] text-slate-500 font-mono font-bold outline-none cursor-not-allowed"
                                    value={pendingCpf}
                                    disabled
                                />
                            </div>

                            {/* Nome Completo */}
                            <div>
                                <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1 ml-1">Nome Completo</label>
                                <input
                                    type="text"
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 px-4 text-[11px] text-slate-900 focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-semibold uppercase"
                                    placeholder="Nome Completo do Paciente"
                                    value={newPatientName}
                                    onChange={(e) => setNewPatientName(e.target.value.toUpperCase())}
                                    required
                                />
                            </div>

                            {/* Data de Nascimento */}
                            <div>
                                <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1 ml-1">Data de Nascimento</label>
                                <input
                                    type="date"
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3.5 px-4 text-[11px] text-slate-900 focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-semibold cursor-pointer"
                                    value={newPatientBirthDate}
                                    onChange={(e) => setNewPatientBirthDate(e.target.value)}
                                    required
                                />
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsRegModalOpen(false);
                                        setPatientCpf('');
                                    }}
                                    className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-extrabold text-[11px] uppercase tracking-wider hover:bg-slate-50 transition-all active:scale-98"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={registering}
                                    className="flex-1 py-3 rounded-xl bg-pink-600 hover:bg-pink-700 text-white font-black text-[11px] uppercase tracking-wider transition-all shadow-md hover:shadow-lg active:scale-98 flex items-center justify-center gap-2"
                                >
                                    {registering ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Salvando...
                                        </>
                                    ) : (
                                        'Cadastrar'
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* SUCCESS MODAL */}
            {isSuccessModalOpen && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200/50 p-6 flex flex-col items-center text-center transform transition-all duration-300 scale-100">
                        <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-4 text-emerald-500 shadow-inner animate-bounce">
                            <CheckCircle2 className="w-8 h-8" />
                        </div>
                        <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider mb-2">
                            Dispensação Realizada!
                        </h3>
                        <p className="text-[11px] text-slate-500 font-semibold mb-6">
                            A retirada do medicamento foi registrada e o estoque foi atualizado com sucesso.
                        </p>
                        <button
                            onClick={() => {
                                setIsSuccessModalOpen(false);
                                onNavigate('farmacia');
                            }}
                            className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-black text-[11px] uppercase tracking-wider rounded-xl transition-all shadow-md hover:shadow-lg active:scale-98"
                        >
                            Ok, Voltar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
