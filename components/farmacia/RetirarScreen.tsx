import React, { useState, useEffect, useMemo } from 'react';
import { User, FarmaciaMedicamento, FarmaciaMovimentacao, ConsultaPaciente, AppState } from '../../types';
import { ArrowLeft, User as UserIcon, Calendar, ClipboardList, CheckCircle2, AlertTriangle, Search, Loader2, History, X, FileDown, Pill, ShieldCheck, FileText } from 'lucide-react';
import * as db from '../../services/farmaciaService';
import { getPacientes, createPaciente } from '../../services/consultasService';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { FarmaciaPdfGenerator } from './FarmaciaPdfGenerator';
import { useFarmaciaAlert } from './FarmaciaAlertContext';

interface RetirarScreenProps {
    currentUser?: User | null;
    onBack: () => void;
    onNavigate: (view: string) => void;
    appState: any;
}

export const RetirarScreen: React.FC<RetirarScreenProps> = ({
    currentUser,
    onBack,
    onNavigate,
    appState
}) => {
    const { showAlert } = useFarmaciaAlert();

    // DB Data states
    const [medicamentos, setMedicamentos] = useState<FarmaciaMedicamento[]>([]);
    const [pacientes, setPacientes] = useState<ConsultaPaciente[]>([]);
    const [recentWithdrawals, setRecentWithdrawals] = useState<FarmaciaMovimentacao[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Helper to get local date time formatted for datetime-local (YYYY-MM-DDTHH:mm:ss)
    const getFormattedDateTimeLocal = () => {
        const d = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };

    // Form inputs
    const [patientName, setPatientName] = useState('');
    const [patientCpf, setPatientCpf] = useState('');
    const [isPatientUnlocked, setIsPatientUnlocked] = useState(false);
    const [selectedMedId, setSelectedMedId] = useState('');
    const [quantity, setQuantity] = useState('');
    const [withdrawalDate, setWithdrawalDate] = useState(getFormattedDateTimeLocal());
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
    const [newPatientNickname, setNewPatientNickname] = useState('');
    const [newPatientPhone, setNewPatientPhone] = useState('');
    const [newPatientNeighborhood, setNewPatientNeighborhood] = useState('');
    const [newPatientStreet, setNewPatientStreet] = useState('');
    const [newPatientCity, setNewPatientCity] = useState('SÃO JOSÉ DO GOIABAL -MG');
    const [newPatientSusNumber, setNewPatientSusNumber] = useState('');
    const [registering, setRegistering] = useState(false);

    // Success notification modal state
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [createdMov, setCreatedMov] = useState<FarmaciaMovimentacao | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [printingMov, setPrintingMov] = useState<FarmaciaMovimentacao | null>(null);

    // Medicamento modal selection states
    const [isMedModalOpen, setIsMedModalOpen] = useState(false);
    const [medModalSearch, setMedModalSearch] = useState('');
    const [medModalCategory, setMedModalCategory] = useState<'TODOS' | 'CBAF' | 'CESAF' | 'CEAF'>('TODOS');

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

    useEffect(() => {
        const interval = setInterval(() => {
            setWithdrawalDate(getFormattedDateTimeLocal());
        }, 1000);
        return () => clearInterval(interval);
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
            // Show first 8 medicines if no query entered yet
            return medicamentos.slice(0, 8);
        }
        const query = medSearchQuery.toLowerCase();
        return medicamentos.filter(m => 
            m.nome.toLowerCase().startsWith(query) || 
            (m.principio_ativo || '').toLowerCase().startsWith(query)
        ).slice(0, 8);
    }, [medicamentos, medSearchQuery]);

    // Active selected medicine batch detail

    // Active selected medicine batch detail
    const selectedMed = useMemo(() => {
        return medicamentos.find(m => m.id === selectedMedId);
    }, [medicamentos, selectedMedId]);

    // Filtered list of medicines for select modal
    const modalMedOptions = useMemo(() => {
        // Se a busca estiver vazia, não retorna nada (aguarda pesquisa)
        if (!medModalSearch.trim()) {
            return [];
        }

        let list = [...medicamentos];
        
        // Filter by category tab
        if (medModalCategory !== 'TODOS') {
            list = list.filter(m => m.categoria === medModalCategory);
        }
        
        // Filter by search query (observando iniciais exatas - startsWith)
        const query = medModalSearch.toLowerCase();
        const filteredList = list.filter(m => 
            m.nome.toLowerCase().startsWith(query) ||
            (m.principio_ativo || '').toLowerCase().startsWith(query) ||
            m.lote.toLowerCase().startsWith(query)
        );
        
        // Agrupar e manter apenas o lote com vencimento mais antigo (menor validade)
        const grouped = new Map<string, typeof list[0]>();
        
        filteredList.forEach(m => {
            const key = `${m.nome}-${m.dosagem || ''}-${m.tipo || ''}`;
            const existing = grouped.get(key);
            
            if (!existing) {
                grouped.set(key, m);
            } else {
                const existingHasStock = existing.quantidade > 0;
                const currentHasStock = m.quantidade > 0;
                
                // Se o existente não tem estoque e o atual tem, damos preferência ao atual
                if (!existingHasStock && currentHasStock) {
                    grouped.set(key, m);
                } 
                // Se ambos têm estoque (ou ambos não têm), pegamos a menor validade
                else if (existingHasStock === currentHasStock) {
                    const dateExisting = new Date(existing.validade).getTime();
                    const dateCurrent = new Date(m.validade).getTime();
                    
                    if (dateCurrent < dateExisting) {
                        grouped.set(key, m);
                    }
                }
            }
        });
        
        return Array.from(grouped.values()).sort((a, b) => a.nome.localeCompare(b.nome));
    }, [medicamentos, medModalSearch, medModalCategory]);

    // Filter withdrawals for the active patient
    const patientWithdrawals = useMemo(() => {
        const nameQuery = patientName.trim().toLowerCase();
        const cpfQuery = patientCpf.replace(/\D/g, '');
        const today = new Date();
        const todayYear = today.getFullYear();
        const todayMonth = today.getMonth();
        const todayDay = today.getDate();

        return recentWithdrawals.filter(w => {
            if (!w.data) return false;
            const wDateObj = new Date(w.data);
            const isToday = wDateObj.getDate() === todayDay &&
                            wDateObj.getMonth() === todayMonth &&
                            wDateObj.getFullYear() === todayYear;

            if (!isToday) return false;

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
                const displayName = found.nickname ? `${found.name} (${found.nickname})` : found.name;
                setPatientName(displayName);
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

    // Format Phone Input: (00) 00000-0000 or (00) 0000-0000
    const handlePhoneChange = (val: string) => {
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
        setNewPatientPhone(formatted);
    };

    // Download Receipt PDF
    const handleDownloadPdf = async (mov?: FarmaciaMovimentacao | null) => {
        const targetMov = mov || createdMov;
        if (!targetMov) return;
        setIsGenerating(true);
        setPrintingMov(targetMov);

        // Allow template portal to render
        await new Promise(resolve => setTimeout(resolve, 500));

        try {
            const container = document.getElementById('farmacia-pdf-content');
            if (!container) {
                console.error("PDF container not found");
                return;
            }

            const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

            const canvas = await html2canvas(container, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                logging: false,
                backgroundColor: '#ffffff',
                scrollY: 0,
                scrollX: 0,
                width: container.offsetWidth,
                height: container.offsetHeight
            });

            const imgData = canvas.toDataURL('image/jpeg', 0.98);
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);

            const protocol = targetMov.id.substring(0, 8).toUpperCase();
            pdf.save(`Comprovante-Retirada-Farmacia-${protocol}.pdf`);
        } catch (error) {
            console.error('Erro ao gerar PDF do agendamento:', error);
            showAlert('Não foi possível gerar o PDF no momento.', 'error');
        } finally {
            setIsGenerating(false);
            setPrintingMov(null);
        }
    };

    // Pre-submit validation to open confirmation modal
    const handlePreSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!patientName || !patientCpf || !selectedMedId || !quantity || !withdrawalDate) {
            showAlert('Por favor, preencha todos os campos obrigatórios.', 'error');
            return;
        }

        const qtyNum = parseInt(quantity, 10);
        if (isNaN(qtyNum) || qtyNum <= 0) {
            showAlert('A quantidade deve ser um número inteiro maior que zero.', 'error');
            return;
        }

        if (!selectedMed) {
            showAlert('Selecione um medicamento válido.', 'error');
            return;
        }

        setIsConfirmModalOpen(true);
    };

    // Real checkout / save handler
    const handleConfirmSubmit = async () => {
        if (!patientName || !patientCpf || !selectedMedId || !quantity || !withdrawalDate) {
            showAlert('Por favor, preencha todos os campos obrigatórios.', 'error');
            return;
        }

        const qtyNum = parseInt(quantity, 10);
        if (isNaN(qtyNum) || qtyNum <= 0 || !selectedMed) {
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

        // Create mock local movement log for optimistic UI
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
            responsavel_nome: currentUser?.name || '',
            responsavel_id: currentUser?.id || '',
            data: new Date(withdrawalDate).toISOString(),
            observacoes: observacoes
        };
        setRecentWithdrawals(prev => [optimisticLog, ...prev]);

        // Keep copy of values to clear or restore
        const savedPatientName = patientName;
        const savedPatientCpf = patientCpf;
        const savedSelectedMed = selectedMed;
        const savedQuantity = quantity;
        const savedWithdrawalDate = withdrawalDate;
        const savedObservacoes = observacoes;

        // Clear form fields immediately for crisp UX
        setQuantity('');
        setObservacoes('');
        setSelectedMedId('');
        setMedSearchQuery('');
        setPatientName('');
        setPatientCpf('');
        setIsPatientUnlocked(false);

        try {
            const result = await db.registrarMovimentacao({
                medicamento_id: savedSelectedMed.id,
                tipo: 'Saída',
                quantidade: qtyNum,
                medicamento_nome: savedSelectedMed.nome,
                medicamento_categoria: savedSelectedMed.categoria,
                medicamento_tipo: savedSelectedMed.tipo,
                medicamento_dosagem: savedSelectedMed.dosagem,
                lote: savedSelectedMed.lote,
                validade: savedSelectedMed.validade,
                paciente_nome: savedPatientName,
                paciente_cpf: savedPatientCpf.replace(/\D/g, ''),
                responsavel_nome: currentUser?.name || '',
                responsavel_id: currentUser?.id || '',
                data: new Date(savedWithdrawalDate).toISOString(),
                observacoes: savedObservacoes
            });

            // Trigger visual refresh of all local caches
            await loadData(true);
            setIsConfirmModalOpen(false);
            setCreatedMov(result);
            setIsSuccessModalOpen(true);
        } catch (err: any) {
            // Revert optimistic updates on error
            setMedicamentos(originalMedState);
            setRecentWithdrawals(originalRecentMovsState);
            // Restore form values so the user doesn't lose inputs
            setPatientName(savedPatientName);
            setPatientCpf(savedPatientCpf);
            setSelectedMedId(savedSelectedMed.id);
            setQuantity(savedQuantity);
            setObservacoes(savedObservacoes);
            setIsPatientUnlocked(true);
            showAlert(err.message || 'Erro ao registrar a retirada.', 'error');
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

    const formatDateTimeBr = (d: string) => {
        if (!d) return '';
        const dateObj = new Date(d);
        if (isNaN(dateObj.getTime())) return d;
        const pad = (n: number) => String(n).padStart(2, '0');
        const day = pad(dateObj.getDate());
        const month = pad(dateObj.getMonth() + 1);
        const year = dateObj.getFullYear();
        const hours = pad(dateObj.getHours());
        const minutes = pad(dateObj.getMinutes());
        const seconds = pad(dateObj.getSeconds());
        return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
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

                <form onSubmit={handlePreSubmit} className="flex-1 flex flex-col justify-between gap-4 min-h-0 overflow-hidden">
                    <div className="space-y-4 min-h-0 overflow-y-auto pr-1 custom-scrollbar">
                        {/* Linha 1: CPF do Paciente + Medicamento */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">CPF do Paciente</label>
                                <input
                                    type="text"
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm text-slate-900 focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-mono font-bold"
                                    placeholder="000.000.000-00"
                                    value={patientCpf}
                                    onChange={(e) => handleCpfChange(e.target.value)}
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Medicamento (Lote/Categoria)</label>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMedModalSearch('');
                                        setMedModalCategory('TODOS');
                                        setIsMedModalOpen(true);
                                    }}
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm text-slate-900 focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-semibold uppercase cursor-pointer flex justify-between items-center select-none text-left"
                                >
                                    {selectedMed ? (
                                        <span className="text-slate-900 font-extrabold truncate">
                                            {selectedMed.nome} {selectedMed.dosagem ? `(${selectedMed.dosagem})` : ''} - Lote: {selectedMed.lote} (Disp: {selectedMed.quantidade} {selectedMed.unidade})
                                        </span>
                                    ) : (
                                        <span className="text-slate-400 normal-case font-medium">
                                            Selecione o medicamento...
                                        </span>
                                    )}
                                    <Search className="w-4 h-4 text-slate-400 shrink-0 ml-2" />
                                </button>
                            </div>
                        </div>

                        {/* Linha 2: Paciente + Quantidade */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="relative">
                                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Paciente</label>
                                <input
                                    type="text"
                                    className={`w-full rounded-xl border border-slate-200 py-3 px-4 text-sm text-slate-900 outline-none transition-all font-semibold uppercase ${
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
                                                    const displayName = p.nickname ? `${p.name} (${p.nickname})` : p.name;
                                                    setPatientName(displayName);
                                                    handleCpfChange(p.cpf);
                                                    setShowPatientDropdown(false);
                                                }}
                                                className="w-full text-left px-4 py-2.5 hover:bg-pink-50 text-slate-700 text-xs font-semibold border-b border-slate-50 last:border-0 flex items-center justify-between"
                                            >
                                                <span>{p.name}</span>
                                                <span className="text-[10px] text-slate-400 font-mono">
                                                    {p.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Quantidade</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm text-slate-900 focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-bold"
                                        placeholder="Qtde"
                                        value={quantity}
                                        onChange={(e) => setQuantity(e.target.value)}
                                        min="1"
                                        required
                                    />
                                    {selectedMed && (
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">
                                            {selectedMed.unidade}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Linha 3: Observações / Receita */}
                        <div>
                            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Observações / Receita</label>
                            <textarea
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm text-slate-900 focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-semibold min-h-[80px]"
                                placeholder="Ex: Receita do Dr. João, validade 6 meses..."
                                value={observacoes}
                                onChange={(e) => setObservacoes(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full py-3.5 rounded-xl bg-pink-600 hover:bg-pink-700 text-white font-black text-xs uppercase tracking-widest transition-all shadow-md hover:shadow-lg active:scale-98 flex items-center justify-center gap-2 shrink-0"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Processando...
                            </>
                        ) : (
                            'Finalizar Atendimento'
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
                                    Histórico de Dispensações de Hoje
                                </h3>
                                {patientName ? (
                                    <p className="text-[9px] text-pink-600 font-bold uppercase mt-0.5">
                                        Filtrado por: {patientName} {patientCpf && `(${patientCpf})`}
                                    </p>
                                ) : (
                                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">
                                        Mostrando apenas retiradas realizadas na data de hoje
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
                                                        {formatDateTimeBr(w.data)}
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
                                    <h4 className="text-xs font-extrabold text-slate-700">Nenhum registro encontrado hoje</h4>
                                    <p className="text-[9px] text-slate-500 text-center mt-0.5 font-medium">
                                        {patientName ? `Não encontramos retiradas de hoje para o paciente "${patientName}".` : "Nenhuma retirada realizada na data de hoje."}
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
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200/50 flex flex-col animate-in zoom-in-95 duration-200">
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
                                    setNewPatientName('');
                                    setNewPatientNickname('');
                                    setNewPatientBirthDate('');
                                    setNewPatientPhone('');
                                    setNewPatientNeighborhood('');
                                    setNewPatientStreet('');
                                    setNewPatientCity('SÃO JOSÉ DO GOIABAL -MG');
                                    setNewPatientSusNumber('');
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
                                if (!newPatientName || !pendingCpf || !newPatientBirthDate || !newPatientCity) {
                                    showAlert('Por favor, preencha todos os campos obrigatórios.', 'error');
                                    return;
                                }
                                setRegistering(true);
                                try {
                                    const created = await createPaciente({
                                        name: newPatientName,
                                        nickname: newPatientNickname.trim() || null,
                                        cpf: pendingCpf.replace(/\D/g, ''),
                                        birth_date: newPatientBirthDate,
                                        phone: newPatientPhone.trim() || null,
                                        neighborhood: newPatientNeighborhood.trim() || null,
                                        street: newPatientStreet.trim() || null,
                                        city: newPatientCity.trim() || null,
                                        sus_number: newPatientSusNumber.trim() || null
                                    });
                                    if (created) {
                                        // Update local patients state list
                                        setPacientes(prev => [...prev, created]);
                                        // Set values to form and unlock
                                        const displayName = created.nickname ? `${created.name} (${created.nickname})` : created.name;
                                        setPatientName(displayName);
                                        setPatientCpf(pendingCpf);
                                        setIsPatientUnlocked(true);
                                        // Clear registration states
                                        setNewPatientName('');
                                        setNewPatientNickname('');
                                        setNewPatientBirthDate('');
                                        setNewPatientPhone('');
                                        setNewPatientNeighborhood('');
                                        setNewPatientStreet('');
                                        setNewPatientCity('SÃO JOSÉ DO GOIABAL -MG');
                                        setNewPatientSusNumber('');
                                        setIsRegModalOpen(false);
                                        showAlert('Paciente cadastrado com sucesso!', 'success');
                                    } else {
                                        showAlert('Erro ao cadastrar paciente.', 'error');
                                    }
                                } catch (err: any) {
                                    showAlert(err.message || 'Erro ao cadastrar paciente.', 'error');
                                } finally {
                                    setRegistering(false);
                                }
                            }}
                            className="p-5 space-y-3.5 text-left"
                        >
                            {/* Linha 1: CPF e Nome Completo */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="md:col-span-1">
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 ml-1">CPF do Paciente</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-xl border border-slate-200 bg-slate-100 py-2.5 px-3.5 text-xs text-slate-500 font-mono font-bold outline-none cursor-not-allowed shadow-inner"
                                        value={pendingCpf}
                                        disabled
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 ml-1">Nome Completo *</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3.5 text-xs text-slate-900 focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-semibold uppercase shadow-inner"
                                        placeholder="Nome Completo do Paciente"
                                        value={newPatientName}
                                        onChange={(e) => setNewPatientName(e.target.value.toUpperCase())}
                                        required
                                    />
                                </div>
                            </div>

                            {/* Linha 2: Apelido, Data de Nascimento e Telefone */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 ml-1">Apelido</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3.5 text-xs text-slate-900 focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-semibold uppercase shadow-inner"
                                        placeholder="Ex: Netinho"
                                        value={newPatientNickname}
                                        onChange={(e) => setNewPatientNickname(e.target.value.toUpperCase())}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 ml-1">Data de Nascimento *</label>
                                    <input
                                        type="date"
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3.5 text-xs text-slate-900 focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-semibold cursor-pointer shadow-inner"
                                        value={newPatientBirthDate}
                                        onChange={(e) => setNewPatientBirthDate(e.target.value)}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 ml-1">Telefone</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3.5 text-xs text-slate-900 focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-semibold shadow-inner"
                                        placeholder="(00) 00000-0000"
                                        value={newPatientPhone}
                                        onChange={(e) => handlePhoneChange(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Linha 3: Número do SUS e Rua */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 ml-1">Número do SUS</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3.5 text-xs text-slate-900 focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-bold tracking-wider shadow-inner"
                                        placeholder="000 0000 0000 0000"
                                        value={newPatientSusNumber}
                                        onChange={(e) => setNewPatientSusNumber(e.target.value.replace(/\D/g, '').slice(0, 15))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 ml-1">Rua</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3.5 text-xs text-slate-900 focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-semibold uppercase shadow-inner"
                                        placeholder="Ex: Rua Principal, 10"
                                        value={newPatientStreet}
                                        onChange={(e) => setNewPatientStreet(e.target.value.toUpperCase())}
                                    />
                                </div>
                            </div>

                            {/* Linha 4: Bairro e Cidade */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 ml-1">Bairro</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3.5 text-xs text-slate-900 focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-semibold uppercase shadow-inner"
                                        placeholder="Ex: Centro"
                                        value={newPatientNeighborhood}
                                        onChange={(e) => setNewPatientNeighborhood(e.target.value.toUpperCase())}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 ml-1">Cidade *</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3.5 text-xs text-slate-900 focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-semibold uppercase shadow-inner"
                                        placeholder="Ex: São José do Goiabal - MG"
                                        value={newPatientCity}
                                        onChange={(e) => setNewPatientCity(e.target.value.toUpperCase())}
                                        required
                                    />
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsRegModalOpen(false);
                                        setPatientCpf('');
                                        setNewPatientName('');
                                        setNewPatientNickname('');
                                        setNewPatientBirthDate('');
                                        setNewPatientPhone('');
                                        setNewPatientNeighborhood('');
                                        setNewPatientStreet('');
                                        setNewPatientCity('SÃO JOSÉ DO GOIABAL -MG');
                                        setNewPatientSusNumber('');
                                    }}
                                    className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-700 font-extrabold text-xs uppercase tracking-wider hover:bg-slate-50 transition-all active:scale-98"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={registering}
                                    className="flex-1 py-3 rounded-xl bg-pink-600 hover:bg-pink-700 text-white font-black text-xs uppercase tracking-wider transition-all shadow-md hover:shadow-lg active:scale-98 flex items-center justify-center gap-2"
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
            {/* CONFIRMATION MODAL (PRÉ-SALVAMENTO) - DESIGN PREMIUM MODERNIZADO */}
            {isConfirmModalOpen && selectedMed && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md transition-all">
                    <div className="bg-white rounded-[32px] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] w-full max-w-md overflow-hidden border border-slate-100 flex flex-col animate-in fade-in zoom-in-95 slide-in-from-bottom-8 duration-300 ease-out max-h-[92vh]">
                        {/* Header com Gradiente Moderno */}
                        <div className="p-5 border-b border-slate-50 flex justify-between items-center bg-gradient-to-r from-slate-50 via-white to-pink-50/20 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500 to-rose-500 flex items-center justify-center text-white shadow-[0_8px_16px_-4px_rgba(219,39,119,0.3)] shrink-0 animate-pulse">
                                    <AlertTriangle className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-800 uppercase text-xs tracking-wider">
                                        Confirmar Atendimento
                                    </h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 tracking-tight">
                                        Revise os dados da retirada
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Content Body */}
                        <div className="p-6 flex-1 flex flex-col justify-between gap-5 overflow-hidden text-left bg-gradient-to-b from-white to-slate-50/50 relative">
                            {saving && (
                                <div className="absolute inset-0 bg-white/90 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-3.5 animate-in fade-in duration-200">
                                    <div className="relative flex items-center justify-center">
                                        <div className="w-14 h-14 rounded-full border-4 border-slate-100 border-t-pink-600 animate-spin"></div>
                                        <Pill className="w-6 h-6 text-pink-600 absolute animate-pulse" />
                                    </div>
                                    <div className="text-center">
                                        <span className="block text-slate-800 font-black text-xs uppercase tracking-widest">
                                            Finalizando Atendimento
                                        </span>
                                        <span className="block text-slate-400 text-[9px] font-bold uppercase mt-1">
                                            Registrando no sistema...
                                        </span>
                                    </div>
                                </div>
                            )}
                            <div className="space-y-3.5 flex-1 flex flex-col justify-center">
                                {/* Paciente (Apelido), CPF */}
                                <div className="bg-white hover:bg-slate-50/50 border border-slate-100 p-3.5 rounded-2xl shadow-sm transition-all flex items-start gap-3 group">
                                    <div className="w-8 h-8 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                        <UserIcon className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <span className="block text-[8px] font-black uppercase text-slate-400 tracking-wider mb-0.5">Beneficiário</span>
                                        <div className="text-xs font-black text-slate-800 uppercase break-words whitespace-normal leading-tight">
                                            {patientName} {
                                                (() => {
                                                    const p = pacientes.find(pat => pat.cpf.replace(/\D/g, '') === patientCpf.replace(/\D/g, ''));
                                                    return p?.nickname ? `(${p.nickname})` : '';
                                                })()
                                            }
                                        </div>
                                        <div className="text-[10px] text-slate-500 font-mono font-bold mt-0.5">
                                            CPF: {patientCpf}
                                        </div>
                                    </div>
                                </div>

                                {/* Medicamento (Lote/Categoria) */}
                                <div className="bg-white hover:bg-slate-50/50 border border-slate-100 p-3.5 rounded-2xl shadow-sm transition-all flex items-start gap-3 group">
                                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                        <Pill className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <span className="block text-[8px] font-black uppercase text-slate-400 tracking-wider mb-0.5">Medicamento (Lote/Categoria)</span>
                                        <div className="text-xs font-black text-slate-800 uppercase break-words whitespace-normal leading-tight">
                                            {selectedMed.nome} {selectedMed.dosagem ? `(${selectedMed.dosagem})` : ''} {selectedMed.tipo ? `• ${selectedMed.tipo}` : ''}
                                        </div>
                                        <div className="text-[10px] text-slate-500 font-semibold mt-0.5">
                                            Lote: <span className="font-mono font-bold text-slate-700">{selectedMed.lote}</span> • Categoria: <span className="font-bold text-slate-700">{selectedMed.categoria}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Quantidade e Data/Hora */}
                                <div className="grid grid-cols-2 gap-3.5">
                                    <div className="bg-white hover:bg-slate-50/50 border border-slate-100 p-3.5 rounded-2xl shadow-sm transition-all flex items-center gap-2.5 group">
                                        <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                            <CheckCircle2 className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <span className="block text-[8px] font-black uppercase text-slate-400 tracking-wider">Quantidade</span>
                                            <span className="font-black text-slate-800 text-xs">
                                                {quantity} <span className="text-[10px] font-bold text-slate-400 lowercase">{selectedMed.unidade || 'un'}</span>
                                            </span>
                                        </div>
                                    </div>

                                    <div className="bg-white hover:bg-slate-50/50 border border-slate-100 p-3.5 rounded-2xl shadow-sm transition-all flex items-center gap-2.5 group">
                                        <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                            <Calendar className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <span className="block text-[8px] font-black uppercase text-slate-400 tracking-wider">Data / Hora</span>
                                            <span className="font-mono font-bold text-slate-700 text-[10px] block truncate">
                                                {formatDateTimeBr(new Date(withdrawalDate).toISOString())}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Observações / Receita (caso haja) */}
                                {observacoes && observacoes.trim() && (
                                    <div className="bg-white hover:bg-slate-50/50 border border-slate-100 p-3.5 rounded-2xl shadow-sm transition-all flex items-start gap-3 group">
                                        <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                            <FileText className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <span className="block text-[8px] font-black uppercase text-slate-400 tracking-wider mb-0.5">Observações / Receita</span>
                                            <p className="text-slate-600 text-[11px] font-semibold leading-relaxed max-h-[44px] overflow-hidden text-ellipsis whitespace-pre-line">
                                                {observacoes}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Responsável pela Entrega */}
                                <div className="bg-white hover:bg-slate-50/50 border border-slate-100 p-3.5 rounded-2xl shadow-sm transition-all flex items-center gap-3 group">
                                    <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                                        <ShieldCheck className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <span className="block text-[8px] font-black uppercase text-slate-400 tracking-wider mb-0.5">Responsável pela Entrega</span>
                                        <span className="font-bold text-slate-700 text-xs block truncate">{currentUser?.name || ''}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3.5 pt-2 shrink-0">
                                <button
                                    onClick={() => handleConfirmSubmit()}
                                    disabled={saving}
                                    className="flex-1 py-3 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 disabled:from-pink-400 disabled:to-rose-400 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-[0_8px_20px_-6px_rgba(219,39,119,0.4)] hover:shadow-[0_12px_24px_-4px_rgba(219,39,119,0.5)] active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    {saving ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Salvando...
                                        </>
                                    ) : (
                                        'Confirmar e Finalizar'
                                    )}
                                </button>
                                <button
                                    onClick={() => setIsConfirmModalOpen(false)}
                                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs uppercase tracking-wider rounded-2xl transition-all active:scale-98 shadow-sm"
                                >
                                    Voltar e Corrigir
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* SUCCESS MODAL (SIMPLES E DIRETO) - DESIGN PREMIUM MODERNIZADO */}
            {isSuccessModalOpen && createdMov && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md transition-all">
                    <div className="bg-white rounded-[32px] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] w-full max-w-sm overflow-hidden border border-slate-100 flex flex-col animate-in fade-in zoom-in-95 slide-in-from-bottom-8 duration-300 ease-out">
                        <div className="p-7 text-center space-y-5 bg-gradient-to-b from-white to-slate-50/50">
                            {/* Icone e Efeito de Pulsar */}
                            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-[0_12px_24px_-6px_rgba(16,185,129,0.4)] mx-auto animate-bounce duration-1000">
                                <CheckCircle2 className="w-9 h-9" />
                            </div>
                            
                            <div>
                                <h3 className="font-black text-slate-800 uppercase text-xs tracking-wider font-extrabold">
                                    Atendimento Finalizado!
                                </h3>
                                <p className="text-[11px] text-slate-505 font-semibold mt-2.5 leading-relaxed">
                                    A retirada foi registrada no sistema com sucesso. O comprovante está pronto para download abaixo.
                                </p>
                            </div>

                            <div className="bg-slate-50 border border-slate-100 py-2.5 px-4 rounded-2xl text-[10px] font-mono font-black text-slate-600 inline-flex items-center gap-1.5 mx-auto shadow-inner">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping"></span>
                                Protocolo: {createdMov.id.substring(0, 8).toUpperCase()}
                            </div>

                            <div className="flex flex-col gap-3 pt-3">
                                <button
                                    onClick={() => handleDownloadPdf()}
                                    disabled={isGenerating}
                                    className="w-full py-3 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 disabled:from-pink-400 disabled:to-rose-400 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-[0_8px_20px_-6px_rgba(219,39,119,0.4)] hover:shadow-[0_12px_24px_-4px_rgba(219,39,119,0.5)] active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
                                >
                                    {isGenerating ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Gerando PDF...
                                        </>
                                    ) : (
                                        <>
                                            <FileDown className="w-4.5 h-4.5" />
                                            Baixar PDF do Comprovante
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={() => {
                                        setIsSuccessModalOpen(false);
                                        setCreatedMov(null);
                                        onNavigate('farmacia');
                                    }}
                                    className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs uppercase tracking-wider rounded-2xl transition-all active:scale-98"
                                >
                                    Ok, Voltar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* PDF Portal Rendering */}
            {printingMov && (
                <FarmaciaPdfGenerator
                    movimentacaoId={printingMov.id}
                    pacienteNome={printingMov.paciente_nome || ''}
                    pacienteCpf={printingMov.paciente_cpf || ''}
                    pacienteApelido={
                        (() => {
                            const p = pacientes.find(pat => pat.cpf.replace(/\D/g, '') === printingMov.paciente_cpf);
                            return p?.nickname;
                        })()
                    }
                    medicamentoNome={printingMov.medicamento_nome}
                    medicamentoCategoria={printingMov.medicamento_categoria}
                    medicamentoDosagem={printingMov.medicamento_dosagem}
                    medicamentoTipo={printingMov.medicamento_tipo}
                    lote={printingMov.lote}
                    quantidade={printingMov.quantidade}
                    unidade={
                        (() => {
                            const m = medicamentos.find(med => med.id === printingMov.medicamento_id);
                            return m?.unidade || 'Unidade';
                        })()
                    }
                    data={printingMov.data}
                    observacoes={printingMov.observacoes}
                    currentUser={currentUser}
                    state={appState}
                />
            )}

            {/* MEDICAMENTO SELECT MODAL */}
            {isMedModalOpen && (
                <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[80vh] overflow-hidden border border-slate-200/50 flex flex-col animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="font-extrabold text-slate-800 uppercase text-xs tracking-wider">
                                    Selecionar Medicamento
                                </h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                                    Escolha um lote disponível no estoque
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsMedModalOpen(false)}
                                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Search and Category filters */}
                        <div className="p-4 bg-white border-b border-slate-100 space-y-3">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Buscar por nome, lote, dosagem..."
                                    className="w-full pl-10 pr-8 py-2.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:border-pink-500 bg-slate-50 focus:bg-white transition-all placeholder:text-slate-400"
                                    value={medModalSearch}
                                    onChange={(e) => setMedModalSearch(e.target.value)}
                                    autoFocus
                                />
                                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                {medModalSearch && (
                                    <button
                                        type="button"
                                        onClick={() => setMedModalSearch('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* Categories tabs */}
                            <div className="flex gap-1.5">
                                {(['TODOS', 'CBAF', 'CESAF', 'CEAF'] as const).map(cat => (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => setMedModalCategory(cat)}
                                        className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all ${
                                            medModalCategory === cat
                                                ? 'bg-pink-600 text-white shadow-sm'
                                                : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                                        }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scrollbar min-h-0">
                            {modalMedOptions.length > 0 ? (
                                modalMedOptions.map(med => {
                                    const isLowStock = med.quantidade <= med.limite_minimo;
                                    const qtyBadgeColor = med.quantidade === 0 
                                        ? 'bg-rose-50 text-rose-700 border-rose-100' 
                                        : isLowStock 
                                            ? 'bg-amber-50 text-amber-700 border-amber-100' 
                                            : 'bg-emerald-50 text-emerald-700 border-emerald-100';

                                    const isExpired = new Date(med.validade).getTime() <= Date.now();

                                    return (
                                        <div
                                            key={med.id}
                                            onClick={() => {
                                                setSelectedMedId(med.id);
                                                setMedSearchQuery(`${med.nome.toUpperCase()} ${med.dosagem ? `(${med.dosagem})` : ''} - Lote: ${med.lote} (Disp: ${med.quantidade} ${med.unidade})`);
                                                setIsMedModalOpen(false);
                                            }}
                                            className="w-full text-left p-3.5 rounded-2xl border border-slate-150/70 hover:border-pink-300 hover:bg-pink-50/20 cursor-pointer transition-all flex flex-col gap-2 group animate-in fade-in slide-in-from-bottom-2 duration-150"
                                        >
                                            <div className="flex justify-between items-start w-full">
                                                <div>
                                                    <h4 className="font-black text-sm uppercase text-slate-800 group-hover:text-pink-700 transition-colors">
                                                        {med.nome} {med.dosagem ? `(${med.dosagem})` : ''}
                                                    </h4>
                                                    <div className="flex flex-wrap gap-1 mt-1">
                                                        <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded bg-pink-50 text-pink-600">
                                                            {med.categoria}
                                                        </span>
                                                        {med.tipo && (
                                                            <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded bg-slate-100 text-slate-500">
                                                                {med.tipo}
                                                            </span>
                                                        )}
                                                        {med.principio_ativo && (
                                                            <span className="px-1.5 py-0.5 text-[8px] font-extrabold uppercase tracking-wider rounded bg-emerald-50 text-emerald-700 border border-emerald-100">
                                                                P.Ativo: {med.principio_ativo}
                                                            </span>
                                                        )}
                                                        <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded bg-slate-50 border border-slate-200 text-slate-500 font-mono">
                                                            Lote: {med.lote}
                                                        </span>
                                                    </div>
                                                </div>
                                                <span className={`inline-flex px-2 py-1 rounded-lg text-[10px] font-black border uppercase tracking-wider shrink-0 ${qtyBadgeColor}`}>
                                                    {med.quantidade} {med.unidade}
                                                </span>
                                            </div>

                                            <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-100 pt-2 mt-1">
                                                <span className="font-semibold">
                                                    Validade: <span className={isExpired ? 'text-rose-500 font-bold' : 'font-bold'}>
                                                        {formatDateBr(med.validade)}
                                                        {isExpired && ' (Vencido)'}
                                                    </span>
                                                </span>
                                                {med.fornecedor && (
                                                    <span className="font-medium italic truncate max-w-[200px]">
                                                        Forn: {med.fornecedor}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                                    <Search className="w-12 h-12 mb-2 opacity-20 text-slate-500" />
                                    {!medModalSearch.trim() ? (
                                        <>
                                            <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Aguardando pesquisa</h4>
                                            <p className="text-[10px] text-slate-500 text-center mt-1 font-medium">
                                                Digite as iniciais do nome, princípio ativo ou lote para buscar.
                                            </p>
                                        </>
                                    ) : (
                                        <>
                                            <h4 className="text-xs font-extrabold text-slate-700">Nenhum lote em estoque</h4>
                                            <p className="text-[10px] text-slate-500 text-center mt-0.5 font-medium">
                                                Não encontramos medicamentos que correspondam aos filtros selecionados.
                                            </p>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
