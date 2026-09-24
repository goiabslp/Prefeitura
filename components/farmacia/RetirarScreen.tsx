import React, { useState, useEffect, useMemo } from 'react';
import { User, FarmaciaMedicamento, FarmaciaMovimentacao, FarmaciaMedico, ConsultaPaciente, AppState, AGENTES_DE_SAUDE } from '../../types';
import { ArrowLeft, User as UserIcon, Calendar, ClipboardList, CheckCircle2, AlertTriangle, Search, Loader2, History, X, FileDown, Pill, ShieldCheck, FileText, Plus, Trash2, Minus, UserPlus, ChevronDown, Sparkles, Check, Stethoscope, UserCheck } from 'lucide-react';
import * as db from '../../services/farmaciaService';
import { normalizeCrmAndUf } from './dashboard/MedicosDashboardTab';
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

    // CRM & Prescritor com Autocomplete Dinâmico
    const [medicoCrm, setMedicoCrm] = useState('');
    const [medicoUf, setMedicoUf] = useState('MG');
    const [medicoNome, setMedicoNome] = useState('');
    const [medicoSearchQuery, setMedicoSearchQuery] = useState('');
    const [showMedicoDropdown, setShowMedicoDropdown] = useState(false);
    const [medicosCadastrados, setMedicosCadastrados] = useState<Record<string, FarmaciaMedico>>({});

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

        const carregarMedicos = async () => {
            try {
                const map = await db.getMedicosCadastrados();
                setMedicosCadastrados(map);
            } catch (e) {
                console.error('[RetirarScreen] Erro ao carregar médicos cadastrados:', e);
            }
        };

        carregarMedicos();

        const handleMedChange = () => loadData(true);
        const handleMovChange = () => loadData(true);
        const handleMedicosChange = () => carregarMedicos();

        window.addEventListener('farmacia-medicamentos-changed', handleMedChange);
        window.addEventListener('farmacia-movimentacoes-changed', handleMovChange);
        window.addEventListener('farmacia-medicos-changed', handleMedicosChange);

        return () => {
            window.removeEventListener('farmacia-medicamentos-changed', handleMedChange);
            window.removeEventListener('farmacia-movimentacoes-changed', handleMovChange);
            window.removeEventListener('farmacia-medicos-changed', handleMedicosChange);
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

    // Lista consolidada de médicos conhecidos para sugestão no autocomplete
    const allKnownDoctors = useMemo(() => {
        const map: Record<string, { crm: string; uf: string; nome?: string; count: number; displayLabel: string }> = {};

        // 1. Médicos explicitamente cadastrados no sistema
        Object.values(medicosCadastrados).forEach(med => {
            if (!med.crm) return;
            const cleanCrm = med.crm.replace(/\D/g, '');
            const cleanUf = (med.uf || 'MG').toUpperCase();
            const key = `${cleanCrm}_${cleanUf}`;
            map[key] = {
                crm: cleanCrm,
                uf: cleanUf,
                nome: med.nome || undefined,
                count: 0,
                displayLabel: med.nome ? `${med.nome} — CRM ${cleanCrm}/${cleanUf}` : `CRM ${cleanCrm} / ${cleanUf}`
            };
        });

        // 2. Médicos identificados a partir do histórico de dispensações
        recentWithdrawals.forEach(m => {
            const norm = normalizeCrmAndUf(m.medico_crm, m.medico_uf, m.observacoes);
            if (!norm) return;
            const key = `${norm.crm}_${norm.uf}`;
            const cadastrado = medicosCadastrados[key];
            const nomeFinal = cadastrado?.nome || (m.medico_nome && !m.medico_nome.startsWith('MÉDICO PRESCRITOR') ? m.medico_nome : undefined);
            if (!map[key]) {
                map[key] = {
                    crm: norm.crm,
                    uf: norm.uf,
                    nome: nomeFinal,
                    count: 0,
                    displayLabel: nomeFinal ? `${nomeFinal} — CRM ${norm.crm}/${norm.uf}` : `CRM ${norm.crm} / ${norm.uf}`
                };
            }
            map[key].count += 1;
        });

        return Object.values(map);
    }, [medicosCadastrados, recentWithdrawals]);

    // Sugestões filtradas dinamicamente com base na busca (Nome, CRM, UF)
    const medicoSuggestions = useMemo(() => {
        const q = medicoSearchQuery.trim().toLowerCase();
        if (!q) return [];
        const cleanQ = q.replace(/\D/g, '');

        return allKnownDoctors.filter(doc => {
            const matchCrm = cleanQ ? doc.crm.includes(cleanQ) : false;
            const matchNome = doc.nome ? doc.nome.toLowerCase().includes(q) : false;
            const matchUf = doc.uf.toLowerCase().includes(q);
            const matchCombined = `${doc.crm}/${doc.uf}`.toLowerCase().includes(q) || `${doc.crm} ${doc.uf}`.toLowerCase().includes(q) || doc.displayLabel.toLowerCase().includes(q);
            return matchCrm || matchNome || matchUf || matchCombined;
        }).sort((a, b) => {
            if (a.nome && !b.nome) return -1;
            if (!a.nome && b.nome) return 1;
            return b.count - a.count;
        }).slice(0, 6);
    }, [allKnownDoctors, medicoSearchQuery]);

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
        const finalMedicoNome = medicoNome || medicosCadastrados[`${cleanCrm}_${medicoUf}`]?.nome || `MÉDICO PRESCRITOR (CRM ${cleanCrm}/${medicoUf})`;

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
            medico_nome: finalMedicoNome,
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
        const savedMedicoNome = finalMedicoNome;
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
        setMedicoNome('');
        setMedicoSearchQuery('');
        setShowMedicoDropdown(false);
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
                    medico_nome: savedMedicoNome,
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
        <div className="w-full max-w-none mx-auto h-full min-h-0 overflow-hidden flex flex-col flex-1 gap-2.5">
            {/* Top Bar / Header Moderno */}
            <div className="bg-white border-2 border-slate-200/90 rounded-2xl px-4 py-2 shadow-xs flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 text-white flex items-center justify-center shadow-xs">
                        <Pill className="w-4 h-4" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-black text-slate-900 text-xs md:text-sm uppercase tracking-tight">Dispensação de Medicamentos</h3>
                            <span className="px-2 py-0.5 rounded-full bg-pink-100 text-pink-700 text-[9px] font-black uppercase tracking-wider">
                                Atendimento
                            </span>
                        </div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Preencha os dados da receita e selecione os itens para dispensação</p>
                    </div>
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
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 shadow-xs hover:shadow-sm active:scale-95 cursor-pointer border border-emerald-700"
                    >
                        <UserPlus className="w-3.5 h-3.5" />
                        Cadastrar Paciente
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsHistoryModalOpen(true)}
                        className="px-3 py-1.5 bg-pink-50 hover:bg-pink-100 text-pink-700 font-black text-[10px] uppercase tracking-wider rounded-xl transition-all flex items-center gap-1.5 border-2 border-pink-200 shadow-xs hover:shadow-sm active:scale-95 cursor-pointer"
                    >
                        <History className="w-3.5 h-3.5" />
                        Ver Histórico
                    </button>
                </div>
            </div>

            {/* Split Form: 2 Colunas Modernas (Esquerda: Paciente + Prescritor + Obs | Direita: Medicamentos + Ação) */}
            <form onSubmit={handlePreSubmit} className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-2.5 overflow-hidden">
                {/* COLUNA ESQUERDA: Paciente, Médico e Observações */}
                <div className="lg:col-span-5 flex flex-col gap-2.5 h-full min-h-0 overflow-hidden">
                    {/* Card 1: Paciente e Prescritor */}
                    <div className="bg-white rounded-2xl border-2 border-slate-200/90 p-3 shadow-xs flex flex-col gap-2 shrink-0">
                        <div className="flex items-center justify-between pb-1 border-b border-slate-100">
                            <div className="flex items-center gap-2">
                                <div className="p-1 rounded-lg bg-pink-100 text-pink-700">
                                    <UserIcon className="w-3.5 h-3.5" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-800">
                                    1. Paciente & Prescritor
                                </span>
                            </div>
                            {isPatientUnlocked && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[8px] font-black uppercase">
                                    <Check className="w-3 h-3 text-emerald-600" /> Identificado
                                </span>
                            )}
                        </div>

                        {/* CPF ou SUS */}
                        <div>
                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-0.5 ml-0.5">
                                CPF / Cartão SUS *
                            </label>
                            <input
                                type="text"
                                className="w-full rounded-xl border-2 border-slate-300 bg-white py-1.5 px-3 text-xs text-slate-900 focus:border-pink-600 focus:ring-4 focus:ring-pink-500/10 outline-none transition-all font-mono font-black placeholder:text-slate-400 shadow-inner"
                                placeholder="000.000.000-00 ou N° SUS"
                                value={patientCpf}
                                onChange={(e) => handleCpfChange(e.target.value)}
                                required
                            />
                        </div>

                        {/* Nome do Paciente com autocomplete */}
                        <div className="relative">
                            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-0.5 ml-0.5">
                                Nome do Paciente *
                            </label>
                            <input
                                type="text"
                                className={`w-full rounded-xl border-2 py-1.5 px-3 text-xs outline-none transition-all font-black uppercase shadow-inner ${
                                    !isPatientUnlocked 
                                        ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed placeholder:text-slate-400' 
                                        : 'bg-white border-slate-300 text-slate-900 focus:border-pink-600 focus:ring-4 focus:ring-pink-500/10 placeholder:text-slate-400'
                                }`}
                                placeholder={!isPatientUnlocked ? "DIGITE O CPF OU SUS PRIMEIRO" : "Nome Completo do Paciente"}
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
                                <div className="absolute left-0 top-full mt-1 w-full bg-white rounded-xl shadow-2xl border-2 border-slate-200 max-h-40 overflow-y-auto z-50 custom-scrollbar">
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
                                            className="w-full text-left px-3 py-2 hover:bg-pink-50 text-slate-800 text-xs font-bold border-b border-slate-100 last:border-0 flex items-center justify-between transition-colors"
                                        >
                                            <span className="font-extrabold text-slate-900">{p.name}</span>
                                            <span className="text-[10px] text-slate-500 font-mono font-bold">
                                                {p.cpf ? `CPF: ${p.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}` : ''}
                                                {p.sus_number ? ` • SUS: ${p.sus_number}` : ''}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* CRM & UF do Médico Prescritor (Campo com Autocomplete Dinâmico) */}
                        <div className="relative">
                            <div className="flex items-center justify-between mb-0.5 ml-0.5">
                                <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                    <Stethoscope className="w-3.5 h-3.5 text-pink-600" />
                                    <span>CRM & UF do Médico Prescritor *</span>
                                </label>
                                {medicoCrm && (
                                    <span className="text-[9px] font-bold text-pink-600 font-mono">
                                        CRM {medicoCrm}/{medicoUf}
                                    </span>
                                )}
                            </div>

                            <div className="flex gap-2 items-center">
                                {/* Campo Principal de Autocomplete */}
                                <div className="relative flex-1">
                                    <input
                                        type="text"
                                        className="w-full rounded-xl border-2 border-slate-300 bg-white py-1.5 pl-8 pr-8 text-xs font-bold text-slate-900 outline-none focus:border-pink-600 focus:ring-4 focus:ring-pink-500/10 transition-all placeholder:text-slate-400 shadow-inner"
                                        placeholder="Pesquise por Nome, CRM ou UF (Ex: João, 12345/MG)..."
                                        value={medicoSearchQuery}
                                        onFocus={() => setShowMedicoDropdown(true)}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setMedicoSearchQuery(val);
                                            setShowMedicoDropdown(true);

                                            // Se o usuário digitar números, atualiza o CRM automaticamente
                                            const onlyDigits = val.replace(/\D/g, '');
                                            if (onlyDigits) {
                                                setMedicoCrm(onlyDigits);
                                            }
                                        }}
                                        required={!medicoCrm}
                                    />
                                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                    {medicoSearchQuery && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setMedicoSearchQuery('');
                                                setMedicoCrm('');
                                                setMedicoNome('');
                                                setShowMedicoDropdown(false);
                                            }}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}

                                    {/* Dropdown de Sugestões de Médicos */}
                                    {showMedicoDropdown && medicoSuggestions.length > 0 && (
                                        <div className="absolute left-0 top-full mt-1 w-full bg-white rounded-xl shadow-2xl border-2 border-slate-200 max-h-48 overflow-y-auto z-50 custom-scrollbar divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-150">
                                            {medicoSuggestions.map((sug, idx) => (
                                                <button
                                                    key={`${sug.crm}_${sug.uf}_${idx}`}
                                                    type="button"
                                                    onMouseDown={() => {
                                                        setMedicoCrm(sug.crm);
                                                        setMedicoUf(sug.uf);
                                                        setMedicoNome(sug.nome || '');
                                                        setMedicoSearchQuery(sug.displayLabel);
                                                        setShowMedicoDropdown(false);
                                                    }}
                                                    className="w-full text-left px-3 py-2 hover:bg-pink-50 text-slate-800 text-xs font-bold flex items-center justify-between transition-colors group cursor-pointer"
                                                >
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <div className="w-7 h-7 rounded-lg bg-pink-100 group-hover:bg-pink-600 group-hover:text-white text-pink-700 flex items-center justify-center shrink-0 transition-colors">
                                                            <Stethoscope className="w-3.5 h-3.5" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <span className="font-extrabold text-slate-900 block truncate">
                                                                {sug.nome || `CRM ${sug.crm}/${sug.uf}`}
                                                            </span>
                                                            <span className="text-[10px] text-slate-500 font-mono font-bold">
                                                                CRM {sug.crm}/{sug.uf} {sug.count > 0 ? `• ${sug.count} receitas` : ''}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[9px] font-black uppercase font-mono shrink-0">
                                                        {sug.uf}
                                                    </span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Campo CRM Numérico para digitação direta */}
                                <div className="w-24">
                                    <input
                                        type="text"
                                        pattern="[0-9]*"
                                        className="w-full rounded-xl border-2 border-slate-300 bg-white py-1.5 px-2 text-xs font-mono font-black text-slate-900 outline-none focus:border-pink-600 focus:ring-4 focus:ring-pink-500/10 transition-all placeholder:text-slate-400 text-center shadow-inner"
                                        placeholder="CRM"
                                        value={medicoCrm}
                                        onChange={(e) => {
                                            const clean = e.target.value.replace(/\D/g, '');
                                            setMedicoCrm(clean);
                                        }}
                                        required
                                        title="Número do CRM"
                                    />
                                </div>

                                {/* Select UF */}
                                <select
                                    className="w-16 rounded-xl border-2 border-slate-300 bg-white py-1.5 px-1.5 text-xs font-black text-slate-900 outline-none focus:border-pink-600 focus:ring-4 focus:ring-pink-500/10 transition-all uppercase cursor-pointer text-center shadow-inner"
                                    value={medicoUf}
                                    onChange={(e) => setMedicoUf(e.target.value)}
                                    title="UF do CRM"
                                >
                                    {['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'].map(uf => (
                                        <option key={uf} value={uf}>{uf}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Badge do Médico Selecionado */}
                            {medicoNome && (
                                <div className="mt-1.5 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold animate-in fade-in">
                                    <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    <span className="truncate">Médico Vinculado: <strong>{medicoNome}</strong> (CRM {medicoCrm}/{medicoUf})</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Card 2: Observações / Dados da Receita */}
                    <div className="flex-1 min-h-0 bg-white rounded-2xl border-2 border-slate-200/90 p-3 shadow-xs flex flex-col justify-between gap-1.5 overflow-hidden">
                        <div className="flex items-center justify-between pb-1 border-b border-slate-100 shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="p-1 rounded-lg bg-pink-100 text-pink-700">
                                    <FileText className="w-3.5 h-3.5" />
                                </div>
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-800">
                                    2. Observações / Receita
                                </span>
                            </div>
                            <span className="text-[8px] font-bold text-slate-400 uppercase">
                                Instruções e posologia
                            </span>
                        </div>

                        {/* Atalhos Rápidos */}
                        <div className="flex flex-wrap gap-1 shrink-0">
                            {[
                                'Uso Contínuo',
                                'Receita Retida',
                                'Validade 30 Dias',
                                'Orientado(a)'
                            ].map(tag => (
                                <button
                                    key={tag}
                                    type="button"
                                    onClick={() => {
                                        if (!observacoes.includes(tag)) {
                                            setObservacoes(prev => prev ? `${prev} • ${tag}` : tag);
                                        }
                                    }}
                                    className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-pink-100 text-slate-700 hover:text-pink-800 text-[8px] font-black uppercase tracking-wider transition-colors border border-slate-200 hover:border-pink-300 active:scale-95 cursor-pointer"
                                >
                                    + {tag}
                                </button>
                            ))}
                        </div>

                        <textarea
                            className="flex-1 min-h-[50px] w-full rounded-xl border-2 border-slate-300 focus:border-pink-600 bg-slate-50/70 focus:bg-white p-2 text-xs text-slate-900 focus:ring-4 focus:ring-pink-500/10 outline-none transition-all font-semibold placeholder:text-slate-400 resize-none custom-scrollbar shadow-inner"
                            placeholder="Digite anotações da receita, dosagens prescritas, recomendações repassadas ao paciente..."
                            value={observacoes}
                            onChange={(e) => setObservacoes(e.target.value)}
                        />
                    </div>
                </div>

                {/* COLUNA DIREITA: Medicamentos e Finalização */}
                <div className="lg:col-span-7 flex flex-col h-full min-h-0 bg-white rounded-2xl border-2 border-slate-200/90 p-3 shadow-xs justify-between gap-2 overflow-hidden">
                    {/* Header da Cesta */}
                    <div className="flex items-center justify-between pb-1.5 border-b-2 border-slate-100 shrink-0">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-xl bg-pink-100 text-pink-700 shadow-xs border border-pink-200/60">
                                <Pill className="w-4 h-4 text-pink-700" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h4 className="font-black text-slate-900 text-xs md:text-sm uppercase tracking-tight">
                                        3. Medicamentos a Dispensar
                                    </h4>
                                    <span className="px-2 py-0.5 rounded-full bg-pink-600 text-white text-[9px] font-black shadow-xs">
                                        {selectedItems.length} {selectedItems.length === 1 ? 'item' : 'itens'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                setMedModalSearch('');
                                setMedModalCategory('TODOS');
                                setIsMedModalOpen(true);
                            }}
                            className="px-3.5 py-1.5 bg-gradient-to-r from-pink-600 via-rose-600 to-pink-600 hover:from-pink-700 hover:to-rose-700 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all shadow-md shadow-pink-600/20 active:scale-95 flex items-center gap-1.5 cursor-pointer border border-pink-700"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Adicionar Medicamento
                        </button>
                    </div>

                    {/* Centro: Lista de Medicamentos ou Empty State Moderno */}
                    {selectedItems.length === 0 ? (
                        <div
                            onClick={() => {
                                setMedModalSearch('');
                                setMedModalCategory('TODOS');
                                setIsMedModalOpen(true);
                            }}
                            className="flex-1 min-h-0 flex flex-col items-center justify-center border-2 border-dashed border-pink-300 hover:border-pink-500 bg-gradient-to-b from-white to-pink-50/25 hover:bg-pink-50/40 rounded-2xl p-4 text-center cursor-pointer transition-all group shadow-inner"
                        >
                            <div className="w-12 h-12 rounded-2xl bg-pink-100 text-pink-600 group-hover:bg-pink-600 group-hover:text-white flex items-center justify-center group-hover:scale-110 transition-all mb-2 shadow-xs border border-pink-200">
                                <Pill className="w-6 h-6" />
                            </div>
                            <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight group-hover:text-pink-700 transition-colors">
                                Nenhum medicamento selecionado
                            </h4>
                            <p className="text-[10px] text-slate-500 font-bold max-w-xs mt-0.5">
                                Clique para abrir o catálogo e incluir os itens da receita
                            </p>
                            <div className="mt-2.5 px-3.5 py-1.5 rounded-xl bg-pink-600 text-white text-[10px] font-black uppercase tracking-wider shadow-xs group-hover:bg-pink-700 transition-colors flex items-center gap-1.5">
                                <Plus className="w-3 h-3" /> Abrir Catálogo
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-1.5 custom-scrollbar">
                            <div className="grid grid-cols-1 gap-1.5">
                                {selectedItems.map((item, idx) => (
                                    <div
                                        key={item.med.id}
                                        className="bg-white border-2 border-slate-200 hover:border-pink-400 p-2 rounded-xl flex items-center justify-between gap-2.5 transition-all shadow-xs"
                                    >
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <div className="w-6 h-6 rounded-lg bg-pink-600 text-white flex items-center justify-center shrink-0 font-black text-[9px] shadow-xs">
                                                #{idx + 1}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h4 className="font-black text-xs uppercase text-slate-950 truncate">
                                                    {item.med.nome} {item.med.dosagem ? `(${item.med.dosagem})` : ''}
                                                </h4>
                                                <div className="flex flex-wrap gap-1 mt-0.5 items-center">
                                                    <span className="px-1.5 py-0.2 text-[8px] font-black uppercase rounded bg-pink-100 text-pink-800 border border-pink-200">
                                                        {item.med.categoria}
                                                    </span>
                                                    <span className="px-1.5 py-0.2 text-[8px] font-black uppercase rounded bg-slate-100 text-slate-700 font-mono border border-slate-200">
                                                        Lote: {item.med.lote}
                                                    </span>
                                                    <span className="text-[9px] font-extrabold text-emerald-700 ml-1">
                                                        Estoque: <strong>{item.med.quantidade} {item.med.unidade}</strong>
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Quantity controls */}
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <div className="flex items-center bg-slate-100 border-2 border-slate-200 rounded-lg p-0.5 shadow-inner">
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateItemQuantity(item.med.id, item.quantity - 1)}
                                                    className="w-5 h-5 rounded bg-white hover:bg-pink-600 hover:text-white text-slate-800 flex items-center justify-center transition-colors active:scale-95 shadow-xs font-bold"
                                                >
                                                    <Minus className="w-2.5 h-2.5" />
                                                </button>
                                                <input
                                                    type="number"
                                                    className="w-9 text-center text-xs font-black text-slate-950 bg-transparent outline-none"
                                                    value={item.quantity}
                                                    onChange={(e) => handleUpdateItemQuantity(item.med.id, parseInt(e.target.value, 10) || 1)}
                                                    min="1"
                                                    max={item.med.quantidade}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateItemQuantity(item.med.id, item.quantity + 1)}
                                                    className="w-5 h-5 rounded bg-white hover:bg-pink-600 hover:text-white text-slate-800 flex items-center justify-center transition-colors active:scale-95 shadow-xs font-bold"
                                                >
                                                    <Plus className="w-2.5 h-2.5" />
                                                </button>
                                            </div>
                                            <span className="text-[10px] font-black text-slate-700 uppercase min-w-[16px]">
                                                {item.med.unidade || 'un'}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveItem(item.med.id)}
                                                className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-100 rounded-lg transition-all"
                                                title="Remover medicamento"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Rodapé da Coluna Direita: Botão de Finalização */}
                    <div className="pt-1.5 border-t-2 border-slate-100 shrink-0">
                        <button
                            type="submit"
                            disabled={saving || selectedItems.length === 0}
                            className="w-full h-10 rounded-xl bg-gradient-to-r from-pink-600 via-rose-600 to-pink-600 hover:from-pink-700 hover:via-rose-700 hover:to-pink-700 disabled:from-slate-200 disabled:to-slate-200 disabled:text-slate-400 text-white font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-pink-600/20 active:scale-98 border-2 border-pink-500 disabled:border-transparent flex items-center justify-center gap-2 cursor-pointer"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Processando Dispensação...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-4 h-4" />
                                    Finalizar Atendimento ({selectedItems.length} {selectedItems.length === 1 ? 'medicamento' : 'medicamentos'})
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </form>

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
