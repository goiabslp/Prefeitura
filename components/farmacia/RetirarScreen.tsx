import React, { useState, useEffect, useMemo } from 'react';
import { User, FarmaciaMedicamento, FarmaciaMovimentacao, ConsultaPaciente, AppState, AGENTES_DE_SAUDE } from '../../types';
import { ArrowLeft, User as UserIcon, Calendar, ClipboardList, CheckCircle2, AlertTriangle, Search, Loader2, History, X, FileDown, Pill, ShieldCheck, FileText, Plus, Trash2, Minus, UserPlus, ChevronDown } from 'lucide-react';
import * as db from '../../services/farmaciaService';
import { getPacientes, createPaciente } from '../../services/consultasService';
import { useAgentesSaude } from '../../services/agentesSaudeService';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { FarmaciaPdfGenerator } from './FarmaciaPdfGenerator';
import { useFarmaciaAlert } from './FarmaciaAlertContext';

export interface SelectedItem {
    med: FarmaciaMedicamento;
    quantity: number;
}

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
    const { items: agentesSaudeItems } = useAgentesSaude();
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
    const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
    const [withdrawalDate, setWithdrawalDate] = useState(getFormattedDateTimeLocal());
    const [observacoes, setObservacoes] = useState('');

    // CRM do Médico
    const [medicoCrm, setMedicoCrm] = useState('');
    const [medicoUf, setMedicoUf] = useState('MG');

    // Autocomplete dropdown UI states
    const [showPatientDropdown, setShowPatientDropdown] = useState(false);
    const [patientSearchQuery, setPatientSearchQuery] = useState('');
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
    const [newPatientAgenteSaude, setNewPatientAgenteSaude] = useState('');
    const [registering, setRegistering] = useState(false);

    // Success notification modal state
    const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [createdMovs, setCreatedMovs] = useState<FarmaciaMovimentacao[]>([]);
    const [createdMov, setCreatedMov] = useState<FarmaciaMovimentacao | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [printingMov, setPrintingMov] = useState<FarmaciaMovimentacao | null>(null);

    // Medicamento modal selection states
    const [isMedModalOpen, setIsMedModalOpen] = useState(false);
    const [medModalSearch, setMedModalSearch] = useState('');
    const [medModalCategory, setMedModalCategory] = useState<'TODOS' | 'CBAF' | 'CESAF' | 'CEAF'>('TODOS');
    const [qtyModalMed, setQtyModalMed] = useState<FarmaciaMedicamento | null>(null);
    const [qtyInput, setQtyInput] = useState<number>(1);

    const handleOpenQtyModal = (med: FarmaciaMedicamento) => {
        const existing = selectedItems.find(si => si.med.id === med.id);
        setQtyModalMed(med);
        setQtyInput(existing ? existing.quantity : 1);
    };

    const handleConfirmQuantity = () => {
        if (!qtyModalMed) return;
        const finalQty = Math.max(0, Math.min(qtyModalMed.quantidade, qtyInput));
        if (finalQty <= 0) {
            handleRemoveItem(qtyModalMed.id);
        } else {
            setSelectedItems(prev => {
                const existingIndex = prev.findIndex(item => item.med.id === qtyModalMed.id);
                if (existingIndex >= 0) {
                    const updated = [...prev];
                    updated[existingIndex] = { ...updated[existingIndex], quantity: finalQty };
                    return updated;
                } else {
                    return [...prev, { med: qtyModalMed, quantity: finalQty }];
                }
            });
        }
        setQtyModalMed(null);
    };

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

    // Filter patients suggestion list (por nome, CPF ou Cartão SUS)
    const patientSuggestions = useMemo(() => {
        if (!patientSearchQuery) return [];
        const query = patientSearchQuery.toLowerCase();
        const cleanQuery = query.replace(/\D/g, '');
        return pacientes.filter(p => 
            p.name.toLowerCase().includes(query) || 
            (p.cpf && p.cpf.replace(/\D/g, '').includes(cleanQuery)) ||
            (p.sus_number && p.sus_number.replace(/\D/g, '').includes(cleanQuery))
        ).slice(0, 5);
    }, [pacientes, patientSearchQuery]);

    // Multi-item management helpers
    const handleAddItem = (med: FarmaciaMedicamento, qty: number = 1) => {
        setSelectedItems(prev => {
            const existingIndex = prev.findIndex(item => item.med.id === med.id);
            if (existingIndex >= 0) {
                const updated = [...prev];
                const currentQty = updated[existingIndex].quantity;
                const newQty = Math.min(med.quantidade, currentQty + qty);
                updated[existingIndex] = { ...updated[existingIndex], quantity: newQty };
                return updated;
            } else {
                const newQty = Math.min(med.quantidade, Math.max(1, qty));
                return [...prev, { med, quantity: newQty }];
            }
        });
    };

    const handleUpdateItemQuantity = (medId: string, newQty: number) => {
        setSelectedItems(prev => prev.map(item => {
            if (item.med.id === medId) {
                const validQty = Math.max(1, Math.min(item.med.quantidade, newQty || 1));
                return { ...item, quantity: validQty };
            }
            return item;
        }));
    };

    const handleRemoveItem = (medId: string) => {
        setSelectedItems(prev => prev.filter(item => item.med.id !== medId));
    };

    // Filtered list of medicines for select modal (apenas exibidos mediante busca)
    const modalMedOptions = useMemo(() => {
        if (!medModalSearch.trim()) return [];

        let list = [...medicamentos];
        
        // Filter by category tab
        if (medModalCategory !== 'TODOS') {
            list = list.filter(m => m.categoria === medModalCategory);
        }
        
        // Filter by search query (utiliza startsWith igual aos outros campos de busca)
        const query = medModalSearch.toLowerCase().trim();
        const matchAtStart = (str: string | undefined | null) => {
            if (!str) return false;
            return str.toLowerCase().startsWith(query);
        };

        list = list.filter(m => 
            matchAtStart(m.nome) ||
            matchAtStart(m.principio_ativo) ||
            matchAtStart(m.lote)
        );
        
        // Agrupar e manter apenas o lote com vencimento mais antigo (menor validade)
        const grouped = new Map<string, typeof list[0]>();
        
        list.forEach(m => {
            const key = `${m.nome}-${m.dosagem || ''}-${m.tipo || ''}`;
            const existing = grouped.get(key);
            
            if (!existing) {
                grouped.set(key, m);
            } else {
                const existingHasStock = existing.quantidade > 0;
                const currentHasStock = m.quantidade > 0;
                
                if (!existingHasStock && currentHasStock) {
                    grouped.set(key, m);
                } 
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

    // Mask CPF / Cartão SUS input helper
    const handleCpfChange = (val: string) => {
        let clean = val.replace(/\D/g, '');
        if (clean.length > 15) clean = clean.slice(0, 15);

        let formatted = clean;
        if (clean.length <= 11) {
            formatted = '';
            if (clean.length > 0) formatted += clean.slice(0, 3);
            if (clean.length > 3) formatted += '.' + clean.slice(3, 6);
            if (clean.length > 6) formatted += '.' + clean.slice(6, 9);
            if (clean.length > 9) formatted += '-' + clean.slice(9, 11);
        } else {
            formatted = '';
            if (clean.length > 0) formatted += clean.slice(0, 3);
            if (clean.length > 3) formatted += ' ' + clean.slice(3, 7);
            if (clean.length > 7) formatted += ' ' + clean.slice(7, 11);
            if (clean.length > 11) formatted += ' ' + clean.slice(11, 15);
        }

        setPatientCpf(formatted);

        const findMatchingPatient = (cleanNum: string) => {
            return pacientes.find(p => 
                (p.cpf && p.cpf.replace(/\D/g, '') === cleanNum) ||
                (p.sus_number && p.sus_number.replace(/\D/g, '') === cleanNum)
            );
        };

        if (clean.length === 11 || clean.length === 15) {
            const found = findMatchingPatient(clean);
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
        } else if (clean.length >= 11) {
            const found = findMatchingPatient(clean);
            if (found) {
                const displayName = found.nickname ? `${found.name} (${found.nickname})` : found.name;
                setPatientName(displayName);
                setIsPatientUnlocked(true);
            } else {
                setPatientName('');
                setIsPatientUnlocked(false);
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
        let targetMov = mov || createdMov;
        if (!targetMov && createdMovs.length > 0) {
            targetMov = createdMovs[0];
        }
        if (!targetMov) return;

        setIsGenerating(true);
        setPrintingMov(targetMov);

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
        if (!patientName || !patientCpf || !withdrawalDate) {
            showAlert('Por favor, preencha os dados do paciente.', 'error');
            return;
        }

        const cleanCrm = medicoCrm.replace(/\D/g, '');
        if (!cleanCrm) {
            showAlert('Por favor, informe o número do CRM do médico prescritor.', 'error');
            return;
        }

        if (selectedItems.length === 0) {
            showAlert('Por favor, selecione pelo menos um medicamento para dispensar.', 'error');
            return;
        }

        for (const item of selectedItems) {
            if (isNaN(item.quantity) || item.quantity <= 0) {
                showAlert(`A quantidade para ${item.med.nome} deve ser maior que zero.`, 'error');
                return;
            }
            if (item.quantity > item.med.quantidade) {
                showAlert(`A quantidade de ${item.med.nome} excede o estoque disponível (${item.med.quantidade} ${item.med.unidade}).`, 'error');
                return;
            }
        }

        setIsConfirmModalOpen(true);
    };

    // Real checkout / save handler
    const handleConfirmSubmit = async () => {
        if (!patientName || !patientCpf || selectedItems.length === 0 || !withdrawalDate) {
            showAlert('Por favor, preencha todos os campos obrigatórios.', 'error');
            return;
        }

        const cleanCrm = medicoCrm.replace(/\D/g, '');
        if (!cleanCrm) {
            showAlert('Por favor, informe o número do CRM do médico prescritor.', 'error');
            return;
        }

        setSaving(true);

        // --- OPTIMISTIC UI UPDATE ---
        const originalMedState = [...medicamentos];
        const originalRecentMovsState = [...recentWithdrawals];

        // Deduct quantity locally for all selected items
        setMedicamentos(prev => prev.map(m => {
            const itemMatch = selectedItems.find(si => si.med.id === m.id);
            if (itemMatch) {
                return { ...m, quantidade: m.quantidade - itemMatch.quantity };
            }
            return m;
        }));

        // Create mock local movement logs for optimistic UI
        const isoDate = new Date(withdrawalDate).toISOString();
        const cleanCpf = patientCpf.replace(/\D/g, '');
        const optimisticLogs: FarmaciaMovimentacao[] = selectedItems.map((item, idx) => ({
            id: 'optimistic-id-' + Date.now() + '-' + idx,
            medicamento_id: item.med.id,
            tipo: 'Saída',
            quantidade: item.quantity,
            medicamento_nome: item.med.nome,
            medicamento_categoria: item.med.categoria,
            medicamento_tipo: item.med.tipo,
            medicamento_dosagem: item.med.dosagem,
            lote: item.med.lote,
            validade: item.med.validade,
            paciente_nome: patientName,
            paciente_cpf: cleanCpf,
            medico_crm: cleanCrm,
            medico_uf: medicoUf,
            medico_nome: `MÉDICO PRESCRITOR (CRM ${cleanCrm}/${medicoUf})`,
            medico_consulta_data: new Date().toISOString(),
            responsavel_nome: currentUser?.name || '',
            responsavel_id: currentUser?.id || '',
            data: isoDate,
            observacoes: observacoes
        }));

        setRecentWithdrawals(prev => [...optimisticLogs, ...prev]);

        // Keep copy of values to clear or restore
        const savedPatientName = patientName;
        const savedPatientCpf = patientCpf;
        const savedMedicoCrm = cleanCrm;
        const savedMedicoUf = medicoUf;
        const savedSelectedItems = [...selectedItems];
        const savedWithdrawalDate = withdrawalDate;
        const savedObservacoes = observacoes;

        // Clear form fields immediately for crisp UX
        setSelectedItems([]);
        setObservacoes('');
        setPatientName('');
        setPatientCpf('');
        setMedicoCrm('');
        setMedicoUf('MG');
        setIsPatientUnlocked(false);

        try {
            const results = await Promise.all(savedSelectedItems.map(item =>
                db.registrarMovimentacao({
                    medicamento_id: item.med.id,
                    tipo: 'Saída',
                    quantidade: item.quantity,
                    medicamento_nome: item.med.nome,
                    medicamento_categoria: item.med.categoria,
                    medicamento_tipo: item.med.tipo,
                    medicamento_dosagem: item.med.dosagem,
                    lote: item.med.lote,
                    validade: item.med.validade,
                    paciente_nome: savedPatientName,
                    paciente_cpf: cleanCpf,
                    medico_crm: savedMedicoCrm,
                    medico_uf: savedMedicoUf,
                    medico_nome: `MÉDICO PRESCRITOR (CRM ${savedMedicoCrm}/${savedMedicoUf})`,
                    medico_consulta_data: new Date().toISOString(),
                    responsavel_nome: currentUser?.name || '',
                    responsavel_id: currentUser?.id || '',
                    data: isoDate,
                    observacoes: savedObservacoes
                })
            ));

            // Trigger visual refresh of all local caches
            await loadData(true);
            setIsConfirmModalOpen(false);
            setCreatedMovs(results);
            setCreatedMov(results[0] || null);
            setIsSuccessModalOpen(true);
        } catch (err: any) {
            // Revert optimistic updates on error
            setMedicamentos(originalMedState);
            setRecentWithdrawals(originalRecentMovsState);
            // Restore form values
            setPatientName(savedPatientName);
            setPatientCpf(savedPatientCpf);
            setMedicoCrm(savedMedicoCrm);
            setMedicoUf(savedMedicoUf);
            setSelectedItems(savedSelectedItems);
            setWithdrawalDate(savedWithdrawalDate);
            setObservacoes(savedObservacoes);
            setIsPatientUnlocked(true);
            setIsConfirmModalOpen(false);
            showAlert('Falha ao registrar a dispensação. Tente novamente.', 'error');
        } finally {
            setSaving(false);
        }
    };

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
                        <h3 className="font-extrabold text-slate-800 text-xs uppercase tracking-tight">Nova Dispensação de Medicamentos</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                setPendingCpf('');
                                setNewPatientName('');
                                setNewPatientBirthDate('');
                                setNewPatientNickname('');
                                setNewPatientPhone('');
                                setNewPatientNeighborhood('');
                                setNewPatientStreet('');
                                setNewPatientCity('SÃO JOSÉ DO GOIABAL -MG');
                                setNewPatientSusNumber('');
                                setNewPatientAgenteSaude('');
                                setIsRegModalOpen(true);
                            }}
                            className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-black text-[9px] uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 border border-emerald-200/50 shadow-sm cursor-pointer"
                        >
                            <UserPlus className="w-3.5 h-3.5" />
                            Cadastrar Paciente
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsHistoryModalOpen(true)}
                            className="px-3.5 py-2 bg-pink-50 hover:bg-pink-100 text-pink-700 font-black text-[9px] uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 border border-pink-200/40 shadow-sm cursor-pointer"
                        >
                            <History className="w-3.5 h-3.5" />
                            Ver Histórico
                        </button>
                    </div>
                </div>

                <form onSubmit={handlePreSubmit} className="flex-1 flex flex-col justify-between gap-4 min-h-0 overflow-hidden">
                    <div className="space-y-4 min-h-0 overflow-y-auto pr-1 custom-scrollbar">
                        {/* Linha 1: CPF do Paciente e Paciente */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">CPF ou Cartão SUS do Paciente *</label>
                                <input
                                    type="text"
                                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm text-slate-900 focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-mono font-bold"
                                    placeholder="CPF (000.000.000-00) ou N° SUS"
                                    value={patientCpf}
                                    onChange={(e) => handleCpfChange(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="relative">
                                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Nome do Paciente *</label>
                                <input
                                    type="text"
                                    className={`w-full rounded-xl border border-slate-200 py-3 px-4 text-sm text-slate-900 outline-none transition-all font-semibold uppercase ${
                                        !isPatientUnlocked 
                                            ? 'bg-slate-100 opacity-60 cursor-not-allowed' 
                                            : 'bg-slate-50 focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10'
                                    }`}
                                    placeholder={!isPatientUnlocked ? "Digite o CPF ou SUS primeiro" : "Nome Completo do Paciente"}
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
                                                    handleCpfChange(p.cpf || p.sus_number || '');
                                                    setShowPatientDropdown(false);
                                                }}
                                                className="w-full text-left px-4 py-2.5 hover:bg-pink-50 text-slate-700 text-xs font-semibold border-b border-slate-50 last:border-0 flex items-center justify-between"
                                            >
                                                <span>{p.name}</span>
                                                <span className="text-[10px] text-slate-400 font-mono">
                                                    {p.cpf ? `CPF: ${p.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}` : ''}
                                                    {p.sus_number ? ` • SUS: ${p.sus_number}` : ''}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Linha 2: CRM do Médico e UF (Compacto) */}
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                            <div className="md:col-span-6 max-w-sm">
                                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">
                                    CRM & UF do Médico *
                                </label>
                                <div className="flex gap-2 items-center">
                                    <div className="relative flex-1 flex items-center">
                                        <input
                                            type="text"
                                            pattern="[0-9]*"
                                            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-3.5 pr-3 text-sm font-mono font-bold text-slate-900 outline-none focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 transition-all"
                                            placeholder="Ex: 12345"
                                            value={medicoCrm}
                                            onChange={(e) => {
                                                const clean = e.target.value.replace(/\D/g, '');
                                                setMedicoCrm(clean);
                                            }}
                                            required
                                        />
                                    </div>
                                    <select
                                        className="w-24 rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-2 text-sm font-bold text-slate-800 outline-none focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 transition-all uppercase cursor-pointer"
                                        value={medicoUf}
                                        onChange={(e) => setMedicoUf(e.target.value)}
                                    >
                                        {['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'].map(uf => (
                                            <option key={uf} value={uf}>{uf}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Linha 3: Lista de Medicamentos a Dispensar (Multi-Item Selection) */}
                        <div className="space-y-2">
                            <div className="flex justify-between items-center px-1">
                                <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500">
                                    Medicamentos a Dispensar ({selectedItems.length}) *
                                </label>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMedModalSearch('');
                                        setMedModalCategory('TODOS');
                                        setIsMedModalOpen(true);
                                    }}
                                    className="px-3 py-1.5 bg-pink-50 hover:bg-pink-100 text-pink-700 font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-all border border-pink-200/50 flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    Adicionar Medicamento
                                </button>
                            </div>

                            {selectedItems.length === 0 ? (
                                <div
                                    onClick={() => {
                                        setMedModalSearch('');
                                        setMedModalCategory('TODOS');
                                        setIsMedModalOpen(true);
                                    }}
                                    className="border-2 border-dashed border-slate-200 hover:border-pink-300 bg-slate-50/50 hover:bg-pink-50/10 rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group"
                                >
                                    <div className="w-10 h-10 rounded-2xl bg-pink-50 text-pink-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <Pill className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <span className="block text-xs font-black text-slate-700 uppercase tracking-wider">
                                            Nenhum medicamento selecionado
                                        </span>
                                        <span className="block text-[10px] text-slate-400 font-medium mt-0.5">
                                            Clique aqui para abrir o catálogo e selecionar medicamentos para este atendimento
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-2.5">
                                    {selectedItems.map((item, idx) => (
                                        <div
                                            key={item.med.id}
                                            className="bg-slate-50/70 border border-slate-200/90 hover:border-pink-200 p-3.5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 transition-all shadow-sm"
                                        >
                                            <div className="flex items-start gap-3 min-w-0 flex-1">
                                                <div className="w-8 h-8 rounded-xl bg-pink-100/70 text-pink-700 flex items-center justify-center shrink-0 font-bold text-xs mt-0.5">
                                                    #{idx + 1}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <h4 className="font-black text-xs uppercase text-slate-900 truncate">
                                                        {item.med.nome} {item.med.dosagem ? `(${item.med.dosagem})` : ''}
                                                    </h4>
                                                    <div className="flex flex-wrap gap-1.5 mt-1 items-center">
                                                        <span className="px-1.5 py-0.5 text-[8px] font-extrabold uppercase rounded bg-pink-100/60 text-pink-700">
                                                            {item.med.categoria}
                                                        </span>
                                                        <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase rounded bg-slate-200/60 text-slate-600 font-mono">
                                                            Lote: {item.med.lote}
                                                        </span>
                                                        <span className="text-[10px] font-bold text-slate-400 ml-1">
                                                            Estoque: <strong className="text-slate-700">{item.med.quantidade} {item.med.unidade}</strong>
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Quantity controls */}
                                            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200/50">
                                                <div className="flex items-center bg-white border border-slate-200 rounded-xl p-1 shadow-inner">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUpdateItemQuantity(item.med.id, item.quantity - 1)}
                                                        className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors active:scale-95"
                                                    >
                                                        <Minus className="w-3.5 h-3.5" />
                                                    </button>
                                                    <input
                                                        type="number"
                                                        className="w-12 text-center text-xs font-black text-slate-900 bg-transparent outline-none"
                                                        value={item.quantity}
                                                        onChange={(e) => handleUpdateItemQuantity(item.med.id, parseInt(e.target.value, 10) || 1)}
                                                        min="1"
                                                        max={item.med.quantidade}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUpdateItemQuantity(item.med.id, item.quantity + 1)}
                                                        className="w-7 h-7 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors active:scale-95"
                                                    >
                                                        <Plus className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                                <span className="text-[10px] font-bold text-slate-500 uppercase min-w-[24px]">
                                                    {item.med.unidade || 'un'}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveItem(item.med.id)}
                                                    className="p-2 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all ml-1"
                                                    title="Remover medicamento"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setMedModalSearch('');
                                            setMedModalCategory('TODOS');
                                            setIsMedModalOpen(true);
                                        }}
                                        className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 font-extrabold text-[11px] uppercase tracking-wider rounded-2xl border border-dashed border-slate-300 transition-all flex items-center justify-center gap-2 cursor-pointer"
                                    >
                                        <Plus className="w-3.5 h-3.5 text-pink-600" />
                                        Adicionar Outro Medicamento
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Linha 3: Observações / Receita */}
                        <div>
                            <label className="block text-[11px] font-black uppercase tracking-wider text-slate-500 mb-1.5 ml-1">Observações / Receita</label>
                            <textarea
                                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 px-4 text-sm text-slate-900 focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-semibold min-h-[70px]"
                                placeholder="Ex: Receita do Dr. João, validade 6 meses..."
                                value={observacoes}
                                onChange={(e) => setObservacoes(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={saving || selectedItems.length === 0}
                        className="w-full py-3.5 rounded-xl bg-pink-600 hover:bg-pink-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-black text-xs uppercase tracking-widest transition-all shadow-md hover:shadow-lg active:scale-98 flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Processando...
                            </>
                        ) : (
                            `Finalizar Atendimento (${selectedItems.length} ${selectedItems.length === 1 ? 'medicamento' : 'medicamentos'})`
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
                                {pendingCpf ? (
                                    <p className="text-[10px] text-pink-600 font-bold uppercase mt-0.5">
                                        Documento {pendingCpf} não cadastrado
                                    </p>
                                ) : (
                                    <p className="text-[10px] text-emerald-600 font-bold uppercase mt-0.5">
                                        Preencha as informações do novo paciente
                                    </p>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsRegModalOpen(false)}
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
                                        sus_number: newPatientSusNumber.trim() || null,
                                        agente_saude: newPatientAgenteSaude.trim() || null
                                    });
                                    if (created) {
                                        setPacientes(prev => [...prev, created]);
                                        const displayName = created.nickname ? `${created.name} (${created.nickname})` : created.name;
                                        setPatientName(displayName);
                                        setPatientCpf(pendingCpf);
                                        setIsPatientUnlocked(true);
                                        setNewPatientName('');
                                        setNewPatientNickname('');
                                        setNewPatientBirthDate('');
                                        setNewPatientPhone('');
                                        setNewPatientNeighborhood('');
                                        setNewPatientStreet('');
                                        setNewPatientCity('SÃO JOSÉ DO GOIABAL -MG');
                                        setNewPatientSusNumber('');
                                        setNewPatientAgenteSaude('');
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
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 ml-1">Número do SUS (Opcional)</label>
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
                                        value={newPatientCity}
                                        onChange={(e) => setNewPatientCity(e.target.value.toUpperCase())}
                                        required
                                    />
                                </div>
                            </div>

                            {/* Linha 5: Agente de Saúde */}
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 ml-1">Agente de Saúde (ACS)</label>
                                <div className="relative">
                                    <select
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-3.5 pr-8 text-xs text-slate-900 focus:bg-white focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-semibold uppercase shadow-inner cursor-pointer appearance-none"
                                        value={newPatientAgenteSaude}
                                        onChange={(e) => setNewPatientAgenteSaude(e.target.value)}
                                    >
                                        <option value="">-- SELECIONE O AGENTE DE SAÚDE (OPCIONAL) --</option>
                                        {agentesSaudeItems.map((item) => (
                                            <option key={item.nome} value={item.nome}>
                                                {item.nome} {item.psf ? `(${item.psf})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                </div>
                            </div>

                            {/* Footer Buttons */}
                            <div className="flex gap-3 pt-3">
                                <button
                                    type="button"
                                    onClick={() => setIsRegModalOpen(false)}
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

            {/* CONFIRMATION MODAL (PRÉ-SALVAMENTO MULTI-ITEM) */}
            {isConfirmModalOpen && selectedItems.length > 0 && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md transition-all">
                    <div className="bg-white rounded-[32px] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] w-full max-w-lg overflow-hidden border border-slate-100 flex flex-col animate-in fade-in zoom-in-95 slide-in-from-bottom-8 duration-300 ease-out max-h-[92vh]">
                        {/* Header com Gradiente Moderno */}
                        <div className="p-5 border-b border-slate-50 flex justify-between items-center bg-gradient-to-r from-slate-50 via-white to-pink-50/20 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500 to-rose-500 flex items-center justify-center text-white shadow-[0_8px_16px_-4px_rgba(219,39,119,0.3)] shrink-0">
                                    <AlertTriangle className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-black text-slate-800 uppercase text-xs tracking-wider">
                                        Confirmar Atendimento ({selectedItems.length} {selectedItems.length === 1 ? 'item' : 'itens'})
                                    </h3>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5 tracking-tight">
                                        Revise os dados da retirada antes de finalizar
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Content Body */}
                        <div className="p-5 flex-1 flex flex-col justify-between gap-4 overflow-hidden text-left bg-gradient-to-b from-white to-slate-50/50 relative min-h-0">
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
                                            Registrando {selectedItems.length} medicamentos no sistema...
                                        </span>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-3 flex-1 overflow-y-auto pr-1 custom-scrollbar">
                                {/* Paciente */}
                                <div className="bg-white border border-slate-100 p-3.5 rounded-2xl shadow-sm flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center shrink-0">
                                        <UserIcon className="w-4 h-4" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <span className="block text-[8px] font-black uppercase text-slate-400 tracking-wider">Beneficiário</span>
                                        <div className="text-xs font-black text-slate-800 uppercase truncate">
                                            {patientName}
                                        </div>
                                        <div className="text-[10px] text-slate-500 font-mono font-bold">
                                            CPF: {patientCpf}
                                        </div>
                                    </div>
                                </div>

                                {/* Lista de Medicamentos */}
                                <div className="bg-white border border-slate-100 rounded-2xl p-3.5 shadow-sm space-y-2">
                                    <span className="block text-[8px] font-black uppercase text-slate-400 tracking-wider mb-1">
                                        Itens a Entregar ({selectedItems.length})
                                    </span>
                                    <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                                        {selectedItems.map((item, idx) => (
                                            <div key={item.med.id} className="py-2 first:pt-0 last:pb-0 flex justify-between items-center text-xs">
                                                <div>
                                                    <div className="font-extrabold text-slate-800 uppercase">
                                                        {idx + 1}. {item.med.nome} {item.med.dosagem ? `(${item.med.dosagem})` : ''}
                                                    </div>
                                                    <div className="text-[9px] text-slate-400 font-semibold font-mono">
                                                        Lote: {item.med.lote} • Cat: {item.med.categoria}
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0 ml-2">
                                                    <span className="font-black text-pink-600 text-xs">
                                                        {item.quantity} {item.med.unidade || 'un'}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Observações / Receita */}
                                {observacoes && observacoes.trim() && (
                                    <div className="bg-white border border-slate-100 p-3 rounded-2xl shadow-sm flex items-start gap-2.5">
                                        <FileText className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                                        <div className="min-w-0 flex-1">
                                            <span className="block text-[8px] font-black uppercase text-slate-400 tracking-wider">Observações / Receita</span>
                                            <p className="text-slate-600 text-[10px] font-semibold leading-relaxed whitespace-pre-line">
                                                {observacoes}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3 pt-2 shrink-0">
                                <button
                                    onClick={() => handleConfirmSubmit()}
                                    disabled={saving}
                                    className="flex-1 py-3 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 disabled:from-pink-400 disabled:to-rose-400 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-[0_8px_20px_-6px_rgba(219,39,119,0.4)] active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
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

            {/* SUCCESS MODAL */}
            {isSuccessModalOpen && createdMov && (
                <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md transition-all">
                    <div className="bg-white rounded-[32px] shadow-[0_25px_50px_-12px_rgba(0,0,0,0.15)] w-full max-w-sm overflow-hidden border border-slate-100 flex flex-col animate-in fade-in zoom-in-95 slide-in-from-bottom-8 duration-300 ease-out">
                        <div className="p-7 text-center space-y-5 bg-gradient-to-b from-white to-slate-50/50">
                            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-white shadow-[0_12px_24px_-6px_rgba(16,185,129,0.4)] mx-auto animate-bounce duration-1000">
                                <CheckCircle2 className="w-9 h-9" />
                            </div>
                            
                            <div>
                                <h3 className="font-black text-slate-800 uppercase text-xs tracking-wider">
                                    Atendimento Finalizado!
                                </h3>
                                <p className="text-[11px] text-slate-500 font-semibold mt-2.5 leading-relaxed">
                                    A retirada de {createdMovs.length} {createdMovs.length === 1 ? 'medicamento foi registrada' : 'medicamentos foi registrada'} com sucesso. O comprovante consolidado está pronto abaixo.
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
                                    className="w-full py-3 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 disabled:from-pink-400 disabled:to-rose-400 text-white font-black text-xs uppercase tracking-widest rounded-2xl transition-all shadow-[0_8px_20px_-6px_rgba(219,39,119,0.4)] active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
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
                                        setCreatedMovs([]);
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
                    itens={
                        createdMovs.length > 0
                            ? createdMovs.map(m => ({
                                medicamentoNome: m.medicamento_nome,
                                medicamentoCategoria: m.medicamento_categoria,
                                medicamentoDosagem: m.medicamento_dosagem,
                                medicamentoTipo: m.medicamento_tipo,
                                lote: m.lote,
                                quantidade: m.quantidade,
                                unidade: (() => {
                                    const medObj = medicamentos.find(med => med.id === m.medicamento_id);
                                    return medObj?.unidade || 'Unidade';
                                })()
                            }))
                            : [{
                                medicamentoNome: printingMov.medicamento_nome,
                                medicamentoCategoria: printingMov.medicamento_categoria,
                                medicamentoDosagem: printingMov.medicamento_dosagem,
                                medicamentoTipo: printingMov.medicamento_tipo,
                                lote: printingMov.lote,
                                quantidade: printingMov.quantidade,
                                unidade: (() => {
                                    const medObj = medicamentos.find(med => med.id === printingMov.medicamento_id);
                                    return medObj?.unidade || 'Unidade';
                                })()
                            }]
                    }
                    data={printingMov.data}
                    observacoes={printingMov.observacoes}
                    currentUser={currentUser}
                    state={appState}
                />
            )}

            {/* MEDICAMENTO SELECT MODAL (MULTI-SELECTION CATÁLOGO) */}
            {isMedModalOpen && (
                <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden border border-slate-200/50 flex flex-col animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
                            <div>
                                <h3 className="font-extrabold text-slate-800 uppercase text-xs tracking-wider">
                                    Catálogo de Medicamentos
                                </h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                                    Selecione os medicamentos e quantidades desejadas ({selectedItems.length} selecionado{selectedItems.length === 1 ? '' : 's'})
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
                        <div className="p-4 bg-white border-b border-slate-100 space-y-3 shrink-0">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Buscar por nome, princípio ativo, lote..."
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
                            {!medModalSearch.trim() ? (
                                <div className="py-16 flex flex-col items-center justify-center text-slate-400">
                                    <Search className="w-12 h-12 mb-3 text-slate-300 animate-pulse" />
                                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">Digite um termo para pesquisar</h4>
                                    <p className="text-[11px] text-slate-400 text-center mt-1 font-semibold max-w-xs">
                                        Digite no campo acima o nome do medicamento, princípio ativo ou número do lote para listar as opções.
                                    </p>
                                </div>
                            ) : modalMedOptions.length > 0 ? (
                                modalMedOptions.map(med => {
                                    const isLowStock = med.quantidade <= med.limite_minimo;
                                    const qtyBadgeColor = med.quantidade === 0 
                                        ? 'bg-rose-50 text-rose-700 border-rose-100' 
                                        : isLowStock 
                                            ? 'bg-amber-50 text-amber-700 border-amber-100' 
                                            : 'bg-emerald-50 text-emerald-700 border-emerald-100';

                                    const isExpired = new Date(med.validade).getTime() <= Date.now();
                                    const existing = selectedItems.find(si => si.med.id === med.id);
                                    const isSelected = !!existing;

                                    return (
                                        <div
                                            key={med.id}
                                            className={`w-full p-4 rounded-2xl border-2 transition-all flex flex-col gap-2.5 relative overflow-hidden ${
                                                isSelected 
                                                    ? 'border-pink-500 bg-pink-50/40 shadow-md shadow-pink-500/10 ring-2 ring-pink-500/20' 
                                                    : 'border-slate-200/80 hover:border-pink-300 hover:bg-pink-50/10 bg-white'
                                            }`}
                                        >
                                            {isSelected && (
                                                <div className="absolute top-0 right-0 bg-pink-600 text-white text-[9px] font-black uppercase px-3 py-1 rounded-bl-xl shadow-xs flex items-center gap-1">
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    <span>Selecionado ({existing.quantity} {med.unidade})</span>
                                                </div>
                                            )}

                                            <div className="flex justify-between items-start w-full pr-24">
                                                <div>
                                                    <h4 className="font-black text-sm uppercase text-slate-800 flex items-center gap-2">
                                                        {med.nome} {med.dosagem ? `(${med.dosagem})` : ''}
                                                    </h4>
                                                    <div className="flex flex-wrap gap-1 mt-1.5">
                                                        <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded bg-pink-100 text-pink-700">
                                                            {med.categoria}
                                                        </span>
                                                        {med.tipo && (
                                                            <span className="px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded bg-slate-100 text-slate-600">
                                                                {med.tipo}
                                                            </span>
                                                        )}
                                                        {med.principio_ativo && (
                                                            <span className="px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-wider rounded bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                                                                P.Ativo: {med.principio_ativo}
                                                            </span>
                                                        )}
                                                        <span className="px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded bg-slate-50 border border-slate-200 text-slate-600 font-mono">
                                                            Lote: {med.lote}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-100 pt-2.5 mt-1">
                                                <div className="flex items-center gap-3">
                                                    <span className="font-semibold">
                                                        Validade: <span className={isExpired ? 'text-rose-500 font-bold' : 'font-bold text-slate-700'}>
                                                            {formatDateBr(med.validade)}
                                                            {isExpired && ' (Vencido)'}
                                                        </span>
                                                    </span>
                                                    <span className={`inline-flex px-2 py-0.5 rounded-lg text-[9px] font-black border uppercase tracking-wider ${qtyBadgeColor}`}>
                                                        Estoque: {med.quantidade} {med.unidade}
                                                    </span>
                                                </div>

                                                {med.quantidade > 0 && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenQtyModal(med)}
                                                        className={`px-3.5 py-1.5 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-1 cursor-pointer ${
                                                            isSelected 
                                                                ? 'bg-purple-600 hover:bg-purple-700' 
                                                                : 'bg-pink-600 hover:bg-pink-700'
                                                        }`}
                                                    >
                                                        <Plus className="w-3.5 h-3.5" />
                                                        <span>{isSelected ? `Alterar (${existing.quantity})` : 'Adicionar'}</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="py-12 flex flex-col items-center justify-center text-slate-400">
                                    <Search className="w-12 h-12 mb-2 opacity-20 text-slate-500" />
                                    <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Nenhum medicamento encontrado</h4>
                                    <p className="text-[10px] text-slate-500 text-center mt-0.5 font-medium">
                                        Não encontramos resultados para "{medModalSearch}". Tente alterar os termos de busca ou a categoria.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center shrink-0">
                            <span className="text-xs font-extrabold text-slate-700">
                                {selectedItems.length} {selectedItems.length === 1 ? 'medicamento selecionado' : 'medicamentos selecionados'}
                            </span>
                            <button
                                type="button"
                                onClick={() => setIsMedModalOpen(false)}
                                className="px-5 py-2.5 bg-pink-600 hover:bg-pink-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md active:scale-95 cursor-pointer"
                            >
                                Concluir Seleção
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE QUANTIDADE DESEJADA */}
            {qtyModalMed && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 flex flex-col animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-pink-50/80 via-purple-50/50 to-white flex justify-between items-start">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded bg-pink-600 text-white">
                                        {qtyModalMed.categoria}
                                    </span>
                                    {qtyModalMed.dosagem && (
                                        <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider rounded bg-pink-100 text-pink-800">
                                            {qtyModalMed.dosagem}
                                        </span>
                                    )}
                                </div>
                                <h3 className="font-black text-slate-800 text-base uppercase leading-tight pt-1">
                                    {qtyModalMed.nome}
                                </h3>
                                <p className="text-[11px] text-slate-500 font-semibold flex items-center gap-2 pt-0.5">
                                    <span>Lote: <strong className="font-mono font-bold text-slate-700">{qtyModalMed.lote}</strong></span>
                                    <span>•</span>
                                    <span>Estoque: <strong className="text-emerald-600 font-extrabold">{qtyModalMed.quantidade} {qtyModalMed.unidade}</strong></span>
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setQtyModalMed(null)}
                                className="p-1.5 hover:bg-slate-200/70 rounded-xl text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Body: Input de quantidade */}
                        <div className="p-6 space-y-4">
                            <label className="block text-xs font-black uppercase tracking-wider text-slate-500 text-center">
                                Informe a quantidade desejada a dispensar
                            </label>

                            <div className="flex items-center justify-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setQtyInput(prev => Math.max(1, prev - 1))}
                                    disabled={qtyInput <= 1}
                                    className="w-12 h-12 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-95 disabled:opacity-40 text-slate-700 flex items-center justify-center font-extrabold text-lg transition-all shadow-sm cursor-pointer"
                                >
                                    <Minus className="w-5 h-5" />
                                </button>

                                <div className="relative">
                                    <input
                                        type="number"
                                        min="1"
                                        max={qtyModalMed.quantidade}
                                        value={qtyInput}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value) || 0;
                                            setQtyInput(Math.max(0, Math.min(qtyModalMed.quantidade, val)));
                                        }}
                                        className="w-32 py-3 px-3 border-2 border-pink-500 rounded-2xl text-center text-2xl font-black font-mono text-slate-900 bg-pink-50/20 focus:outline-none focus:ring-4 focus:ring-pink-500/20 shadow-inner"
                                    />
                                    <span className="block text-[9px] font-extrabold uppercase text-slate-400 text-center mt-1">
                                        {qtyModalMed.unidade || 'Unidades'}
                                    </span>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setQtyInput(prev => Math.min(qtyModalMed.quantidade, prev + 1))}
                                    disabled={qtyInput >= qtyModalMed.quantidade}
                                    className="w-12 h-12 rounded-2xl bg-pink-600 hover:bg-pink-700 active:scale-95 disabled:opacity-40 text-white flex items-center justify-center font-extrabold text-lg transition-all shadow-sm shadow-pink-600/30 cursor-pointer"
                                >
                                    <Plus className="w-5 h-5" />
                                </button>
                            </div>

                            {qtyInput >= qtyModalMed.quantidade && (
                                <p className="text-[10px] font-bold text-amber-600 text-center bg-amber-50 py-1.5 px-3 rounded-xl border border-amber-200/60">
                                    Limite máximo disponível no estoque atingo ({qtyModalMed.quantidade} {qtyModalMed.unidade})
                                </p>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                            <button
                                type="button"
                                onClick={() => setQtyModalMed(null)}
                                className="flex-1 py-3 bg-slate-200/80 hover:bg-slate-300 text-slate-700 font-extrabold text-xs uppercase tracking-wider rounded-2xl transition-all cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmQuantity}
                                className="flex-1 py-3 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl transition-all shadow-md shadow-pink-600/30 active:scale-95 cursor-pointer"
                            >
                                Confirmar Quantidade
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
