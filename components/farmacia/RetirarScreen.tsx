import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { User, FarmaciaMedicamento, FarmaciaMovimentacao, FarmaciaMedico, ConsultaPaciente, AppState, AGENTES_DE_SAUDE } from '../../types';
import { ArrowLeft, User as UserIcon, Calendar, ClipboardList, CheckCircle2, AlertTriangle, Search, Loader2, History, X, FileDown, Pill, ShieldCheck, FileText, Plus, Trash2, Minus, UserPlus, ChevronDown, Sparkles, Check, Stethoscope, UserCheck, ArrowRight, ClipboardCheck, Edit3, RefreshCw } from 'lucide-react';
import * as db from '../../services/farmaciaService';
import { normalizeCrmAndUf } from './dashboard/MedicosDashboardTab';
import { getPacientes, createPaciente, updatePaciente } from '../../services/consultasService';
import { useAgentesSaude } from '../../services/agentesSaudeService';
import { CadastroIncompletoModal, isPatientComplete } from '../common/CadastroIncompletoModal';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { FarmaciaPdfGenerator } from './FarmaciaPdfGenerator';
import { useFarmaciaAlert } from './FarmaciaAlertContext';

export interface SelectedItem {
    med: FarmaciaMedicamento;
    quantity: number;
}

const ESTADOS_BRASIL = [
    'MG', 'SP', 'RJ', 'ES', 'BA', 'DF', 'GO', 'AC', 'AL', 'AP', 'AM', 'CE', 'MA', 
    'MT', 'MS', 'PA', 'PB', 'PR', 'PE', 'PI', 'RN', 'RS', 'RO', 'RR', 'SC', 'SE', 'TO'
];

export type RetirarTab = 'localizar' | 'paciente' | 'medicamentos' | 'medico' | 'revisar';

interface FloatingPortalProps {
    isOpen: boolean;
    targetRef: React.RefObject<HTMLElement | null>;
    onClose?: () => void;
    children: React.ReactNode;
    maxHeight?: number;
    className?: string;
}

const FloatingDropdownPortal: React.FC<FloatingPortalProps> = ({
    isOpen,
    targetRef,
    onClose,
    children,
    maxHeight = 280,
    className = ''
}) => {
    const [coords, setCoords] = useState<{
        top?: number;
        bottom?: number;
        left: number;
        width: number;
        placement: 'bottom' | 'top';
        availableHeight: number;
    } | null>(null);

    const dropdownRef = useRef<HTMLDivElement>(null);

    const updatePosition = () => {
        if (!targetRef.current) return;
        const rect = targetRef.current.getBoundingClientRect();
        const spaceBelow = window.innerHeight - rect.bottom - 12;
        const spaceAbove = rect.top - 12;
        const preferTop = spaceBelow < 200 && spaceAbove > spaceBelow;

        const left = Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8));
        const width = Math.min(rect.width, window.innerWidth - 16);

        if (preferTop) {
            setCoords({
                bottom: window.innerHeight - rect.top + 6,
                left,
                width,
                placement: 'top',
                availableHeight: Math.min(maxHeight, spaceAbove)
            });
        } else {
            setCoords({
                top: rect.bottom + 6,
                left,
                width,
                placement: 'bottom',
                availableHeight: Math.min(maxHeight, spaceBelow)
            });
        }
    };

    useEffect(() => {
        if (!isOpen) {
            setCoords(null);
            return;
        }

        updatePosition();

        const handleScrollOrResize = () => {
            updatePosition();
        };

        const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(e.target as Node) &&
                targetRef.current &&
                !targetRef.current.contains(e.target as Node)
            ) {
                if (onClose) onClose();
            }
        };

        window.addEventListener('resize', handleScrollOrResize, { passive: true });
        window.addEventListener('scroll', handleScrollOrResize, { capture: true, passive: true });
        document.addEventListener('mousedown', handleOutsideClick);
        document.addEventListener('touchstart', handleOutsideClick);

        return () => {
            window.removeEventListener('resize', handleScrollOrResize);
            window.removeEventListener('scroll', handleScrollOrResize, true);
            document.removeEventListener('mousedown', handleOutsideClick);
            document.removeEventListener('touchstart', handleOutsideClick);
        };
    }, [isOpen, targetRef, maxHeight]);

    if (!isOpen || !coords || typeof document === 'undefined') return null;

    const style: React.CSSProperties = {
        position: 'fixed',
        left: `${coords.left}px`,
        width: `${coords.width}px`,
        maxHeight: `${coords.availableHeight}px`,
        zIndex: 99999,
        ...(coords.placement === 'top' ? { bottom: `${coords.bottom}px` } : { top: `${coords.top}px` })
    };

    return createPortal(
        <div
            ref={dropdownRef}
            style={style}
            className={`bg-white rounded-2xl shadow-2xl border border-slate-200/90 overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-150 ${className}`}
        >
            {children}
        </div>,
        document.body
    );
};

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

    // Input container refs para o FloatingDropdownPortal
    const patientInputContainerRef = useRef<HTMLDivElement>(null);
    const medicoInputContainerRef = useRef<HTMLDivElement>(null);

    // DB Data states
    const [medicamentos, setMedicamentos] = useState<FarmaciaMedicamento[]>([]);
    const [pacientes, setPacientes] = useState<ConsultaPaciente[]>([]);
    const [recentWithdrawals, setRecentWithdrawals] = useState<FarmaciaMovimentacao[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Validação de Cadastro Incompleto do Paciente
    const [incompletePatient, setIncompletePatient] = useState<ConsultaPaciente | null>(null);
    const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);

    // Helper to get local date time formatted for datetime-local (YYYY-MM-DDTHH:mm:ss)
    const getFormattedDateTimeLocal = () => {
        const d = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    };

    // Fluxo de Etapas / Abas
    const getInitialTabFromUrl = (): RetirarTab => {
        const path = window.location.pathname;
        if (path.includes('/Retirar/Paciente')) return 'paciente';
        if (path.includes('/Retirar/Medicamentos')) return 'medicamentos';
        if (path.includes('/Retirar/Medico')) return 'medico';
        if (path.includes('/Retirar/Revisar')) return 'revisar';
        return 'localizar';
    };

    const [activeTab, setActiveTab] = useState<RetirarTab>(getInitialTabFromUrl());
    const [selectedPatientObj, setSelectedPatientObj] = useState<ConsultaPaciente | null>(null);

    // Form inputs
    const [patientSearchCpf, setPatientSearchCpf] = useState('');
    const [matchedPatient, setMatchedPatient] = useState<ConsultaPaciente | null>(null);
    const [searchNotFound, setSearchNotFound] = useState(false);
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

    // Patient history & registration UI states
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
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

    // Navegação sincronizada de abas com URL
    const navigateToTab = (tab: RetirarTab) => {
        if (tab !== 'localizar' && !selectedPatientObj) {
            setActiveTab('localizar');
            window.history.pushState({}, '', '/FarmaciaPopular/Retirar');
            return;
        }

        setActiveTab(tab);
        let path = '/FarmaciaPopular/Retirar';
        if (tab === 'paciente') path = '/FarmaciaPopular/Retirar/Paciente';
        else if (tab === 'medicamentos') path = '/FarmaciaPopular/Retirar/Medicamentos';
        else if (tab === 'medico') path = '/FarmaciaPopular/Retirar/Medico';
        else if (tab === 'revisar') path = '/FarmaciaPopular/Retirar/Revisar';

        window.history.pushState({ tab }, '', path);
    };

    // Sincronizar com popstate (botão voltar do navegador)
    useEffect(() => {
        const handlePopState = () => {
            const currentTab = getInitialTabFromUrl();
            if (currentTab !== 'localizar' && !selectedPatientObj) {
                setActiveTab('localizar');
            } else {
                setActiveTab(currentTab);
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [selectedPatientObj]);

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

    // Função de correspondência sequencial a partir do início do campo ou início de uma palavra
    const matchPrefixSequential = (target?: string | null, query?: string | null): boolean => {
        if (!target || !query) return false;
        const t = target.toLowerCase().trim();
        const q = query.toLowerCase().trim();
        if (!q) return false;

        // 1. Início exato do texto
        if (t.startsWith(q)) return true;

        // 2. Início exato de qualquer palavra no texto
        const words = t.split(/[\s,./\\-]+/).filter(Boolean);
        return words.some(word => word.startsWith(q));
    };

    // Helper para extrair CRM e UF a partir de string única digitada
    const parseCrmAndUfInput = (val: string) => {
        const matchCrmUf = val.match(/(\d+)\s*(?:[\/\-]\s*([A-Za-z]{2}))?/);
        if (matchCrmUf) {
            const crmNum = matchCrmUf[1];
            const ufStr = matchCrmUf[2] ? matchCrmUf[2].toUpperCase() : 'MG';
            return { crm: crmNum, uf: ufStr };
        }
        const onlyDigits = val.replace(/\D/g, '');
        return { crm: onlyDigits, uf: 'MG' };
    };

    // Sugestões filtradas sequencialmente a partir do início (CRM, Nome, CRM/UF)
    const medicoSuggestions = useMemo(() => {
        const q = medicoSearchQuery.trim();
        if (!q) return [];
        const cleanQ = q.toLowerCase();
        const digitsQ = q.replace(/\D/g, '');

        return allKnownDoctors.filter(doc => {
            // 1. Se digitou dígitos, verifica se o CRM começa sequencialmente com esses dígitos
            const matchCrm = digitsQ ? doc.crm.startsWith(digitsQ) : false;

            // 2. Se o médico tiver nome, verifica se o nome ou palavra do nome começa com o termo digitado
            const matchNome = doc.nome ? matchPrefixSequential(doc.nome, cleanQ) : false;

            // 3. Correspondência sequencial no rótulo completo ou formato CRM/UF
            const matchLabel = matchPrefixSequential(doc.displayLabel, cleanQ);
            const matchCrmUf = matchPrefixSequential(`${doc.crm}/${doc.uf}`, cleanQ) || matchPrefixSequential(`CRM ${doc.crm}/${doc.uf}`, cleanQ);

            return matchCrm || matchNome || matchLabel || matchCrmUf;
        }).sort((a, b) => {
            // Prioriza correspondência exata do início
            if (digitsQ) {
                const aCrmStart = a.crm.startsWith(digitsQ);
                const bCrmStart = b.crm.startsWith(digitsQ);
                if (aCrmStart && !bCrmStart) return -1;
                if (!aCrmStart && bCrmStart) return 1;
            }
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
            return true;
        });
    }, [recentWithdrawals, patientName, patientCpf]);

    // Formatação de máscara estrita para CPF (11 dígitos: 000.000.000-00)
    const formatCpfMask = (val: string) => {
        let clean = val.replace(/\D/g, '').slice(0, 11);
        let formatted = clean;
        if (clean.length > 9) {
            formatted = `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6, 9)}-${clean.slice(9, 11)}`;
        } else if (clean.length > 6) {
            formatted = `${clean.slice(0, 3)}.${clean.slice(3, 6)}.${clean.slice(6)}`;
        } else if (clean.length > 3) {
            formatted = `${clean.slice(0, 3)}.${clean.slice(3)}`;
        }
        return formatted;
    };

    // Manipulação da digitação do CPF com busca automática somente aos 11 dígitos exatos
    const handleCpfInputChange = (val: string) => {
        const formatted = formatCpfMask(val);
        setPatientSearchCpf(formatted);

        const clean = formatted.replace(/\D/g, '');

        // Com menos de 11 dígitos: não realizar nenhuma consulta
        if (clean.length < 11) {
            setMatchedPatient(null);
            setSearchNotFound(false);
            return;
        }

        // Ao completar exatamente 11 dígitos: pesquisar automaticamente por correspondência exata
        if (clean.length === 11) {
            const found = pacientes.find(p => p.cpf && p.cpf.replace(/\D/g, '') === clean);
            if (found) {
                setMatchedPatient(found);
                setSearchNotFound(false);
            } else {
                setMatchedPatient(null);
                setSearchNotFound(true);
            }
        }
    };

    // Helper para selecionar paciente e checar se seu cadastro está completo
    const selectAndValidatePatient = (patientObj: ConsultaPaciente) => {
        setSearchNotFound(false);
        const displayName = patientObj.nickname ? `${patientObj.name} (${patientObj.nickname})` : patientObj.name;
        const formattedCpf = patientObj.cpf 
            ? patientObj.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
            : (patientObj.sus_number || '');

        setPatientName(displayName);
        setPatientCpf(formattedCpf);
        setSelectedPatientObj(patientObj);

        if (!isPatientComplete(patientObj)) {
            setIncompletePatient(patientObj);
            setIsValidationModalOpen(true);
            setIsPatientUnlocked(false);
        } else {
            setIsPatientUnlocked(true);
            navigateToTab('paciente');
        }
    };

    const handlePatientValidationComplete = (updated: ConsultaPaciente) => {
        setPacientes(prev => prev.map(p => p.id === updated.id ? updated : p));
        const displayName = updated.nickname ? `${updated.name} (${updated.nickname})` : updated.name;
        setPatientName(displayName);
        if (updated.cpf) {
            setPatientCpf(updated.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4"));
        }
        setSelectedPatientObj(updated);
        setIsPatientUnlocked(true);
        setIsValidationModalOpen(false);
        setIncompletePatient(null);
        navigateToTab('paciente');
    };

    // Resetar paciente e voltar para busca
    const handleResetPatient = () => {
        setSelectedPatientObj(null);
        setPatientName('');
        setPatientCpf('');
        setPatientSearchCpf('');
        setMatchedPatient(null);
        setSearchNotFound(false);
        setIsPatientUnlocked(false);
        navigateToTab('localizar');
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

    // Real checkout / save handler
    const handleConfirmSubmit = async () => {
        if (!patientName || !patientCpf || selectedItems.length === 0 || !withdrawalDate) {
            showAlert('Por favor, preencha todos os campos obrigatórios.', 'error');
            return;
        }

        let cleanCrm = medicoCrm.replace(/\D/g, '');
        let effectiveUf = medicoUf || 'MG';

        if (!cleanCrm && medicoSearchQuery) {
            const parsed = parseCrmAndUfInput(medicoSearchQuery);
            cleanCrm = parsed.crm;
            if (parsed.uf) effectiveUf = parsed.uf;
            setMedicoCrm(cleanCrm);
            setMedicoUf(effectiveUf);
        }

        if (!cleanCrm) {
            showAlert('Por favor, informe o número do CRM do médico prescritor.', 'error');
            navigateToTab('medico');
            return;
        }

        setSaving(true);

        const originalMedState = [...medicamentos];
        const originalRecentMovsState = [...recentWithdrawals];

        // Deduct quantity locally for all selected items
        setMedicamentos(prev => prev.map(m => {
            const selected = selectedItems.find(si => si.med.id === m.id);
            if (selected) {
                return { ...m, quantidade: Math.max(0, m.quantidade - selected.quantity) };
            }
            return m;
        }));

        try {
            const cleanCpf = patientCpf.replace(/\D/g, '');
            const createdList: FarmaciaMovimentacao[] = [];

            for (const item of selectedItems) {
                const movData: any = {
                    medicamento_id: item.med.id,
                    medicamento_nome: item.med.nome,
                    medicamento_categoria: item.med.categoria,
                    medicamento_dosagem: item.med.dosagem || '',
                    medicamento_tipo: item.med.tipo || '',
                    lote: item.med.lote,
                    validade: item.med.validade,
                    quantidade: item.quantity,
                    tipo: 'Saída',
                    paciente_nome: patientName,
                    paciente_cpf: cleanCpf,
                    medico_crm: cleanCrm,
                    medico_uf: effectiveUf,
                    medico_nome: medicoNome ? medicoNome : `MÉDICO PRESCRITOR (CRM ${cleanCrm}/${effectiveUf})`,
                    observacoes: observacoes || undefined,
                    responsavel_id: currentUser?.id,
                    responsavel_nome: currentUser?.name || 'Farmacêutico(a)',
                    data: withdrawalDate
                };

                const savedMov = await db.registrarMovimentacao(movData);
                createdList.push(savedMov);
            }

            // Atualiza histórico local
            setRecentWithdrawals(prev => [...createdList, ...prev]);
            setCreatedMovs(createdList);
            setCreatedMov(createdList[0] || null);
            setIsSuccessModalOpen(true);
            setIsConfirmModalOpen(false);

            // Dispara eventos globais
            window.dispatchEvent(new CustomEvent('farmacia-medicamentos-changed'));
            window.dispatchEvent(new CustomEvent('farmacia-movimentacoes-changed'));

        } catch (error) {
            console.error('[RetirarScreen] Error saving withdrawal batch:', error);
            setMedicamentos(originalMedState);
            setRecentWithdrawals(originalRecentMovsState);
            showAlert('Erro ao registrar a retirada no banco de dados.', 'error');
        } finally {
            setSaving(false);
        }
    };

    const formatDateBr = (d?: string) => {
        if (!d) return '';
        const parts = d.split('T')[0].split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
        return d;
    };

    const formatPatientBirthAndAge = (birthDateStr?: string) => {
        if (!birthDateStr) return null;
        try {
            const cleanDate = birthDateStr.split('T')[0];
            const parts = cleanDate.split(/[-/]/);
            if (parts.length === 3) {
                let y: number, m: number, d: number;
                if (parts[0].length === 4) {
                    y = parseInt(parts[0], 10);
                    m = parseInt(parts[1], 10) - 1;
                    d = parseInt(parts[2], 10);
                } else {
                    d = parseInt(parts[0], 10);
                    m = parseInt(parts[1], 10) - 1;
                    y = parseInt(parts[2], 10);
                }
                const bDate = new Date(y, m, d);
                if (!isNaN(bDate.getTime())) {
                    const today = new Date();
                    let age = today.getFullYear() - bDate.getFullYear();
                    const monthDiff = today.getMonth() - bDate.getMonth();
                    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < bDate.getDate())) {
                        age--;
                    }
                    const formatted = `${String(d).padStart(2, '0')}/${String(m + 1).padStart(2, '0')}/${y}`;
                    return `${formatted} (${age} anos)`;
                }
            }
        } catch {
            return birthDateStr;
        }
        return birthDateStr;
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
        <div className="w-full max-w-none mx-auto h-full max-h-full min-h-0 overflow-hidden flex flex-col flex-1 gap-2">
            {/* TOP BAR / HEADER UNIFICADO */}
            <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl px-3 sm:px-4 py-2 shadow-2xs flex items-center justify-between shrink-0 transition-all gap-2">
                {/* Lado Esquerdo: Voltar + Identidade Visual */}
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <button
                        type="button"
                        onClick={() => {
                            if (activeTab !== 'localizar' && selectedPatientObj) {
                                handleResetPatient();
                            } else {
                                onBack();
                            }
                        }}
                        className="group flex items-center gap-1.5 text-slate-500 hover:text-pink-600 font-bold transition-all p-1.5 pr-2.5 rounded-full bg-slate-50 hover:bg-pink-50 border border-slate-200/70 shadow-2xs hover:shadow-xs cursor-pointer shrink-0"
                        title={activeTab !== 'localizar' ? "Novo Atendimento" : "Voltar ao Menu Farmácia"}
                    >
                        <div className="w-5 h-5 rounded-full bg-white border border-slate-200/60 flex items-center justify-center group-hover:bg-pink-100 group-hover:border-pink-200 transition-colors">
                            <ArrowLeft className="w-3 h-3 group-hover:-translate-x-0.5 transition-transform text-slate-500 group-hover:text-pink-600" />
                        </div>
                        <span className="text-[9px] uppercase tracking-widest font-black group-hover:text-pink-700">
                            {activeTab !== 'localizar' ? "Trocar Paciente" : "Voltar"}
                        </span>
                    </button>

                    <div className="flex items-center gap-2 min-w-0">
                        <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-gradient-to-tr from-pink-600 via-rose-500 to-pink-500 text-white flex items-center justify-center shadow-sm shadow-pink-500/25 ring-2 ring-pink-50 shrink-0">
                            <Pill className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-xs sm:text-sm font-black text-slate-800 tracking-tight uppercase leading-none truncate">
                                    Farmácia Popular
                                </h2>
                                <span className="text-slate-300 font-light hidden sm:inline">|</span>
                                <h3 className="text-xs sm:text-sm font-black text-pink-600 tracking-tight uppercase leading-none truncate flex items-center gap-1.5">
                                    Dispensação de Medicamentos
                                </h3>
                                <span className="px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200/80 text-rose-700 text-[8.5px] font-black uppercase tracking-wider flex items-center gap-1 shadow-2xs shrink-0">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                    Atendimento Ativo
                                </span>
                            </div>
                            <p className="text-slate-400 text-[8.5px] sm:text-[9.5px] font-bold uppercase tracking-widest mt-0.5 truncate hidden md:block">
                                Gestão e dispensação de medicamentos • Fluxo de retirada estruturado por etapas
                            </p>
                        </div>
                    </div>
                </div>

                {/* Lado Direito: Ações Rápidas */}
                <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={() => {
                            setPendingCpf(patientSearchCpf || '');
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
                        className="px-2.5 sm:px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-[9.5px] sm:text-[10px] uppercase tracking-wider rounded-xl transition-all flex items-center gap-1 shadow-2xs hover:shadow-xs active:scale-95 cursor-pointer border border-emerald-700/20"
                    >
                        <UserPlus className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Cadastrar Paciente</span>
                        <span className="sm:hidden">Cadastrar</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsHistoryModalOpen(true)}
                        className="px-2.5 sm:px-3 py-1.5 bg-pink-50/90 hover:bg-pink-100 text-pink-700 font-extrabold text-[9.5px] sm:text-[10px] uppercase tracking-wider rounded-xl transition-all flex items-center gap-1 border border-pink-200/80 shadow-2xs hover:shadow-xs active:scale-95 cursor-pointer"
                    >
                        <History className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Ver Histórico</span>
                        <span className="sm:hidden">Histórico</span>
                    </button>
                </div>
            </div>

            {/* SE O PACIENTE ESTIVER LOCALIZADO: EXIBIR STEPPER / BARRA DE ABAS */}
            {selectedPatientObj && activeTab !== 'localizar' && (
                <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl px-3 py-1.5 shadow-2xs flex items-center justify-between gap-2 shrink-0 transition-all">
                    {/* Abas com Progresso */}
                    <div className="flex items-center gap-1 sm:gap-2 flex-1 overflow-x-auto custom-scrollbar">
                        {/* Aba 1: Paciente */}
                        <button
                            type="button"
                            onClick={() => navigateToTab('paciente')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
                                activeTab === 'paciente'
                                    ? 'bg-pink-600 text-white shadow-sm shadow-pink-600/25'
                                    : 'bg-slate-50 hover:bg-pink-50 text-slate-700 hover:text-pink-700 border border-slate-200/70'
                            }`}
                        >
                            <span className="w-4.5 h-4.5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[9px] font-black">
                                ✓
                            </span>
                            <span>1. Paciente</span>
                        </button>

                        <span className="text-slate-300 font-bold text-xs shrink-0">→</span>

                        {/* Aba 2: Medicamentos */}
                        <button
                            type="button"
                            onClick={() => navigateToTab('medicamentos')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
                                activeTab === 'medicamentos'
                                    ? 'bg-pink-600 text-white shadow-sm shadow-pink-600/25'
                                    : selectedItems.length > 0
                                        ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80'
                                        : 'bg-slate-50 hover:bg-pink-50 text-slate-700 hover:text-pink-700 border border-slate-200/70'
                            }`}
                        >
                            <Pill className="w-3.5 h-3.5" />
                            <span>2. Medicamentos</span>
                            {selectedItems.length > 0 && (
                                <span className={`px-1.5 py-0.2 rounded-full text-[8.5px] font-black ${
                                    activeTab === 'medicamentos' ? 'bg-white text-pink-700' : 'bg-emerald-600 text-white'
                                }`}>
                                    {selectedItems.length}
                                </span>
                            )}
                        </button>

                        <span className="text-slate-300 font-bold text-xs shrink-0">→</span>

                        {/* Aba 3: Médico & Receita */}
                        <button
                            type="button"
                            onClick={() => navigateToTab('medico')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
                                activeTab === 'medico'
                                    ? 'bg-pink-600 text-white shadow-sm shadow-pink-600/25'
                                    : (medicoCrm || medicoSearchQuery)
                                        ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80'
                                        : 'bg-slate-50 hover:bg-pink-50 text-slate-700 hover:text-pink-700 border border-slate-200/70'
                            }`}
                        >
                            <Stethoscope className="w-3.5 h-3.5" />
                            <span>3. Médico & Receita</span>
                            {(medicoCrm || medicoSearchQuery) && (
                                <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[8px] font-black">
                                    ✓
                                </span>
                            )}
                        </button>

                        <span className="text-slate-300 font-bold text-xs shrink-0">→</span>

                        {/* Aba 4: Revisar */}
                        <button
                            type="button"
                            onClick={() => navigateToTab('revisar')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
                                activeTab === 'revisar'
                                    ? 'bg-pink-600 text-white shadow-sm shadow-pink-600/25'
                                    : 'bg-slate-50 hover:bg-pink-50 text-slate-700 hover:text-pink-700 border border-slate-200/70'
                            }`}
                        >
                            <ClipboardCheck className="w-3.5 h-3.5" />
                            <span>4. Revisar & Finalizar</span>
                        </button>
                    </div>

                    {/* Resumo do Paciente Selecionado */}
                    <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-50 border border-slate-200/70 shrink-0">
                        <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-[11px] font-black text-slate-900 uppercase truncate max-w-[200px]">
                            {selectedPatientObj.name}
                        </span>
                        <span className="text-[9px] font-mono font-bold text-slate-500">
                            {selectedPatientObj.cpf ? `CPF: ${selectedPatientObj.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}` : (selectedPatientObj.sus_number || '')}
                        </span>
                    </div>
                </div>
            )}

            {/* CORPO PRINCIPAL CONDICIONAL POR ABA */}
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                {/* ========================================================================= */}
                {/* 1. TELA INICIAL: LOCALIZAR PACIENTE (DESIGN ELEGANTE E MODERNO) */}
                {/* ========================================================================= */}
                {(!selectedPatientObj || activeTab === 'localizar') && (
                    <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3 sm:p-5 md:p-6 flex flex-col items-center justify-start bg-slate-50/40">
                        <div className="w-full max-w-4xl lg:max-w-5xl my-auto py-2 flex flex-col gap-4 animate-in fade-in duration-200">
                            {/* Card Principal */}
                            <div className="w-full bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-lg shadow-slate-200/40 p-5 sm:p-7 relative overflow-hidden flex flex-col gap-4 sm:gap-5">
                                {/* Barra decorativa superior em gradiente */}
                                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-pink-500 via-rose-500 to-indigo-500" />

                                {/* Header do Card */}
                                <div className="flex items-start gap-3.5 sm:gap-4 text-left">
                                    <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-pink-600 via-rose-500 to-pink-600 text-white flex items-center justify-center shadow-md shadow-pink-500/25 shrink-0">
                                        <Search className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            <span className="px-2.5 py-0.5 rounded-full bg-pink-50 border border-pink-200/70 text-pink-700 text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1">
                                                <Sparkles className="w-3 h-3 text-pink-500" />
                                                Identificação do Paciente
                                            </span>
                                        </div>
                                        <h2 className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-tight">
                                            Localizar Paciente
                                        </h2>
                                        <p className="text-xs text-slate-500 font-medium mt-0.5">
                                            Digite o CPF do paciente para iniciar o atendimento e a dispensação de medicamentos.
                                        </p>
                                    </div>
                                </div>

                                {/* Campo de CPF com Indicador Inteligente de Dígitos */}
                                <div className="space-y-1.5 text-left">
                                    <div className="flex items-center justify-between">
                                        <label className="block text-xs font-black uppercase tracking-wider text-slate-700">
                                            CPF do Paciente *
                                        </label>
                                        {patientSearchCpf ? (
                                            patientSearchCpf.replace(/\D/g, '').length === 11 ? (
                                                <span className="text-[11px] font-black text-emerald-700 bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-lg inline-flex items-center gap-1 animate-in fade-in duration-150">
                                                    <Check className="w-3 h-3 text-emerald-600" />
                                                    11 dígitos completos
                                                </span>
                                            ) : (
                                                <span className="text-[11px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-lg font-mono">
                                                    {patientSearchCpf.replace(/\D/g, '').length} / 11 dígitos
                                                </span>
                                            )
                                        ) : (
                                            <span className="text-[11px] font-semibold text-slate-400">
                                                11 dígitos numéricos
                                            </span>
                                        )}
                                    </div>

                                    <div className="relative group">
                                        <input
                                            type="text"
                                            autoFocus
                                            className="w-full rounded-2xl border-2 border-slate-200 hover:border-pink-300 focus:border-pink-500 bg-slate-50/50 hover:bg-white focus:bg-white py-3.5 pl-11 pr-11 text-base sm:text-lg font-mono font-black tracking-wider text-slate-900 focus:ring-4 focus:ring-pink-500/10 outline-none transition-all placeholder:text-slate-400 placeholder:font-sans placeholder:font-normal placeholder:tracking-normal shadow-xs"
                                            placeholder="Digite o CPF do paciente"
                                            value={patientSearchCpf}
                                            onChange={(e) => handleCpfInputChange(e.target.value)}
                                            maxLength={14}
                                        />
                                        <Search className="w-5 h-5 text-slate-400 group-focus-within:text-pink-600 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none transition-colors" />
                                        {patientSearchCpf && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setPatientSearchCpf('');
                                                    setMatchedPatient(null);
                                                    setSearchNotFound(false);
                                                }}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1.5 rounded-xl hover:bg-slate-200/70 transition-all cursor-pointer"
                                                title="Limpar campo"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* PACIENTE ENCONTRADO - NO FLUXO NORMAL DA PÁGINA (DOCUMENT FLOW, SEM ABSOLUTE) */}
                                {matchedPatient && (
                                    <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-emerald-50/90 via-white to-teal-50/40 border-2 border-emerald-500/70 shadow-md shadow-emerald-600/10 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                                            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-md shadow-emerald-600/20">
                                                {matchedPatient.name
                                                    ? matchedPatient.name
                                                        .split(' ')
                                                        .filter(Boolean)
                                                        .slice(0, 2)
                                                        .map(n => n[0])
                                                        .join('')
                                                        .toUpperCase()
                                                    : <UserCheck className="w-6 h-6" />}
                                            </div>
                                            <div className="min-w-0 flex-1 text-left">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-200 inline-flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                        Paciente Localizado
                                                    </span>
                                                </div>
                                                <h4 className="text-sm sm:text-base font-black text-slate-900 uppercase leading-snug break-words">
                                                    {matchedPatient.name} {matchedPatient.nickname ? `(${matchedPatient.nickname})` : ''}
                                                </h4>
                                                
                                                {/* Grade de informações detalhadas do paciente */}
                                                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap text-xs text-slate-600 font-mono font-bold mt-2">
                                                    <span className="bg-white px-2 py-0.5 rounded-md border border-slate-200/80 shadow-2xs">
                                                        CPF: {matchedPatient.cpf ? matchedPatient.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : ''}
                                                    </span>
                                                    {matchedPatient.sus_number && (
                                                        <span className="bg-white px-2 py-0.5 rounded-md border border-slate-200/80 font-sans text-[11px] font-semibold text-slate-600 shadow-2xs">
                                                            SUS: {matchedPatient.sus_number}
                                                        </span>
                                                    )}
                                                    {matchedPatient.birth_date && formatPatientBirthAndAge(matchedPatient.birth_date) && (
                                                        <span className="bg-white px-2 py-0.5 rounded-md border border-slate-200/80 font-sans text-[11px] font-semibold text-slate-600 shadow-2xs">
                                                            Nasc: {formatPatientBirthAndAge(matchedPatient.birth_date)}
                                                        </span>
                                                    )}
                                                    {matchedPatient.phone && (
                                                        <span className="bg-white px-2 py-0.5 rounded-md border border-slate-200/80 font-sans text-[11px] font-semibold text-slate-600 shadow-2xs">
                                                            Tel: {matchedPatient.phone}
                                                        </span>
                                                    )}
                                                    {matchedPatient.neighborhood && (
                                                        <span className="bg-white px-2 py-0.5 rounded-md border border-slate-200/80 font-sans text-[11px] font-semibold text-slate-600 shadow-2xs">
                                                            Bairro: {matchedPatient.neighborhood}
                                                        </span>
                                                    )}
                                                    {matchedPatient.street && (
                                                        <span className="bg-white px-2 py-0.5 rounded-md border border-slate-200/80 font-sans text-[11px] font-semibold text-slate-600 shadow-2xs">
                                                            Rua: {matchedPatient.street}
                                                        </span>
                                                    )}
                                                    {matchedPatient.agente_saude && (
                                                        <span className="bg-white px-2 py-0.5 rounded-md border border-slate-200/80 font-sans text-[11px] font-semibold text-slate-600 shadow-2xs">
                                                            ACS: {matchedPatient.agente_saude}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => selectAndValidatePatient(matchedPatient)}
                                            className="px-5 py-3 bg-gradient-to-r from-pink-600 via-rose-600 to-pink-600 hover:from-pink-500 hover:via-rose-500 hover:to-pink-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-pink-600/25 active:scale-95 flex items-center justify-center gap-2 cursor-pointer border border-pink-700/20 shrink-0 whitespace-nowrap group"
                                        >
                                            <span>Continuar Retirada</span>
                                            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                                        </button>
                                    </div>
                                )}

                                {/* PACIENTE NÃO LOCALIZADO (11 DÍGITOS PREENCHIDOS E NÃO ENCONTRADO) */}
                                {searchNotFound && patientSearchCpf.replace(/\D/g, '').length === 11 && (
                                    <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-50/90 via-white to-amber-50/50 border-2 border-amber-300 shadow-sm text-left flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                        <div className="flex items-center gap-3.5 min-w-0">
                                            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 border border-amber-200">
                                                <AlertTriangle className="w-5 h-5" />
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="text-xs sm:text-sm font-black text-amber-900 uppercase">Paciente não localizado</h4>
                                                <p className="text-xs text-amber-700 font-medium mt-0.5">
                                                    Nenhum paciente cadastrado com o CPF <strong className="font-mono font-bold">{patientSearchCpf}</strong>.
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setPendingCpf(patientSearchCpf);
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
                                            className="px-4.5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-1.5 cursor-pointer shrink-0 active:scale-95"
                                        >
                                            <UserPlus className="w-4 h-4" />
                                            <span>Cadastrar Paciente</span>
                                        </button>
                                    </div>
                                )}

                                {/* Rodapé com Estatísticas e Botão de Novo Cadastro */}
                                <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs">
                                    <div className="flex items-center gap-2 text-slate-500 font-medium">
                                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                        <span>Cadastrados no sistema: <strong className="text-slate-800 font-black">{pacientes.length} pacientes</strong></span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setPendingCpf('');
                                            setIsRegModalOpen(true);
                                        }}
                                        className="px-3.5 py-1.5 rounded-xl text-pink-600 hover:text-pink-700 bg-pink-50/80 hover:bg-pink-100 border border-pink-200/80 font-black text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs hover:shadow-xs active:scale-95"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>Novo Cadastro</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ========================================================================= */}
                {/* 2. ABA: PACIENTE */}
                {/* ========================================================================= */}
                {selectedPatientObj && activeTab === 'paciente' && (
                    <div className="flex-1 h-full min-h-0 bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs flex flex-col justify-between gap-3 overflow-hidden animate-in fade-in duration-200">
                        <div className="space-y-3 flex-1 overflow-y-auto pr-1 custom-scrollbar">
                            {/* Header da Aba */}
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-xl bg-pink-50 text-pink-600 border border-pink-100 shadow-2xs">
                                        <UserIcon className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-slate-900 text-xs sm:text-sm uppercase tracking-tight">
                                            Dados do Paciente Identificado
                                        </h3>
                                        <p className="text-[10px] text-slate-400 font-semibold">
                                            Informações recuperadas automaticamente do cadastro
                                        </p>
                                    </div>
                                </div>
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black uppercase shadow-2xs">
                                    <Check className="w-3.5 h-3.5 text-emerald-600" /> Cadastro Validado
                                </span>
                            </div>

                            {/* Grid de Dados Principais */}
                            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                                {/* CPF / Cartão SUS */}
                                <div className="sm:col-span-4 bg-slate-50/70 border border-slate-200/80 rounded-2xl p-3 shadow-2xs">
                                    <label className="block text-[9.5px] font-black uppercase tracking-wider text-slate-500 mb-0.5">
                                        CPF / Documento Principal *
                                    </label>
                                    <div className="text-sm font-black font-mono text-slate-900">
                                        {selectedPatientObj.cpf 
                                            ? selectedPatientObj.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
                                            : (selectedPatientObj.sus_number || 'Não informado')}
                                    </div>
                                </div>

                                {/* Nome do Paciente */}
                                <div className="sm:col-span-8 bg-slate-50/70 border border-slate-200/80 rounded-2xl p-3 shadow-2xs">
                                    <label className="block text-[9.5px] font-black uppercase tracking-wider text-slate-500 mb-0.5">
                                        Nome Completo do Paciente *
                                    </label>
                                    <div className="text-sm font-black uppercase text-slate-900 truncate">
                                        {selectedPatientObj.name} {selectedPatientObj.nickname ? `(${selectedPatientObj.nickname})` : ''}
                                    </div>
                                </div>
                            </div>

                            {/* Informações Complementares em Cards */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                <div className="bg-white border border-slate-200/80 rounded-xl p-2.5 shadow-2xs">
                                    <span className="block text-[8.5px] font-black uppercase tracking-wider text-slate-400">Data de Nascimento</span>
                                    <span className="text-xs font-black font-mono text-slate-800">
                                        {formatDateBr(selectedPatientObj.birth_date) || '—'}
                                    </span>
                                </div>

                                <div className="bg-white border border-slate-200/80 rounded-xl p-2.5 shadow-2xs">
                                    <span className="block text-[8.5px] font-black uppercase tracking-wider text-slate-400">Telefone / Contato</span>
                                    <span className="text-xs font-black text-slate-800">
                                        {selectedPatientObj.phone || '—'}
                                    </span>
                                </div>

                                <div className="bg-white border border-slate-200/80 rounded-xl p-2.5 shadow-2xs">
                                    <span className="block text-[8.5px] font-black uppercase tracking-wider text-slate-400">Bairro</span>
                                    <span className="text-xs font-black uppercase text-slate-800 truncate block">
                                        {selectedPatientObj.neighborhood || '—'}
                                    </span>
                                </div>

                                <div className="bg-white border border-slate-200/80 rounded-xl p-2.5 shadow-2xs">
                                    <span className="block text-[8.5px] font-black uppercase tracking-wider text-slate-400">Agente de Saúde</span>
                                    <span className="text-xs font-black uppercase text-slate-800 truncate block">
                                        {selectedPatientObj.agente_saude || '—'}
                                    </span>
                                </div>
                            </div>

                            {/* Endereço e Cartão SUS */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                <div className="bg-white border border-slate-200/80 rounded-xl p-2.5 shadow-2xs">
                                    <span className="block text-[8.5px] font-black uppercase tracking-wider text-slate-400">Endereço / Logradouro</span>
                                    <span className="text-xs font-black uppercase text-slate-800 truncate block">
                                        {selectedPatientObj.street || '—'}, {selectedPatientObj.city || 'SÃO JOSÉ DO GOIABAL -MG'}
                                    </span>
                                </div>

                                <div className="bg-white border border-slate-200/80 rounded-xl p-2.5 shadow-2xs">
                                    <span className="block text-[8.5px] font-black uppercase tracking-wider text-slate-400">N° Cartão SUS</span>
                                    <span className="text-xs font-black font-mono text-slate-800">
                                        {selectedPatientObj.sus_number || '—'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Barra de Navegação Inferior */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between shrink-0">
                            <button
                                type="button"
                                onClick={handleResetPatient}
                                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                            >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>Trocar Paciente</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => navigateToTab('medicamentos')}
                                className="px-5 py-2.5 bg-gradient-to-r from-pink-600 via-rose-600 to-pink-600 hover:from-pink-500 hover:via-rose-500 hover:to-pink-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-pink-600/25 active:scale-95 flex items-center gap-2 cursor-pointer border border-pink-700/20"
                            >
                                <span>Avançar para Medicamentos</span>
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}

                {/* ========================================================================= */}
                {/* 3. ABA: MEDICAMENTOS */}
                {/* ========================================================================= */}
                {selectedPatientObj && activeTab === 'medicamentos' && (
                    <div className="flex-1 h-full min-h-0 bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-4 shadow-2xs flex flex-col justify-between gap-2.5 overflow-hidden animate-in fade-in duration-200">
                        {/* Header da Aba Medicamentos */}
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100 shrink-0">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-xl bg-pink-50 text-pink-600 border border-pink-100 shadow-2xs">
                                    <Pill className="w-4 h-4 text-pink-600" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-black text-slate-900 text-xs sm:text-sm uppercase tracking-tight">
                                            Itens da Receita a Dispensar
                                        </h3>
                                        <span className="px-2 py-0.5 rounded-full bg-gradient-to-r from-pink-600 to-rose-600 text-white text-[9px] font-black shadow-2xs">
                                            {selectedItems.length} {selectedItems.length === 1 ? 'item' : 'itens'}
                                        </span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-semibold">
                                        Adicione um ou múltiplos medicamentos receitados para o paciente
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => {
                                    setMedModalSearch('');
                                    setMedModalCategory('TODOS');
                                    setIsMedModalOpen(true);
                                }}
                                className="px-3.5 py-2 bg-gradient-to-r from-pink-600 via-rose-600 to-pink-600 hover:from-pink-500 hover:via-rose-500 hover:to-pink-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-pink-600/20 active:scale-95 flex items-center gap-1.5 cursor-pointer border border-pink-700/20"
                            >
                                <Plus className="w-4 h-4" />
                                <span>+ Adicionar Medicamento</span>
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
                                className="flex-1 min-h-0 flex flex-col items-center justify-center border-2 border-dashed border-pink-200 hover:border-pink-400 bg-gradient-to-b from-pink-50/20 via-white to-slate-50/30 hover:bg-pink-50/30 rounded-2xl p-6 text-center cursor-pointer transition-all group shadow-inner"
                            >
                                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-500/15 to-rose-500/10 text-pink-600 group-hover:bg-gradient-to-tr group-hover:from-pink-600 group-hover:to-rose-600 group-hover:text-white flex items-center justify-center group-hover:scale-110 transition-all mb-2 shadow-2xs border border-pink-200/80">
                                    <Pill className="w-6 h-6" />
                                </div>
                                <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight group-hover:text-pink-700 transition-colors">
                                    Nenhum medicamento adicionado ainda
                                </h4>
                                <p className="text-xs text-slate-400 font-semibold max-w-sm mt-1 leading-relaxed">
                                    Clique no botão abaixo para abrir o catálogo de estoque e incluir os medicamentos receitados.
                                </p>
                                <div className="mt-3 px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-black uppercase tracking-wider shadow-sm group-hover:shadow-md transition-all flex items-center gap-1.5">
                                    <Plus className="w-4 h-4" /> Abrir Estoque de Medicamentos
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-2 custom-scrollbar">
                                <div className="grid grid-cols-1 gap-2">
                                    {selectedItems.map((item, idx) => (
                                        <div
                                            key={item.med.id}
                                            className="bg-white border border-slate-200/90 hover:border-pink-400 p-3 rounded-2xl flex items-center justify-between gap-3 transition-all shadow-2xs hover:shadow-xs"
                                        >
                                            <div className="flex items-center gap-3 min-w-0 flex-1">
                                                <div className="w-7 h-7 rounded-xl bg-pink-50 text-pink-700 border border-pink-200/80 flex items-center justify-center shrink-0 font-black text-xs shadow-2xs">
                                                    #{idx + 1}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <h4 className="font-black text-xs sm:text-sm uppercase text-slate-900 truncate">
                                                        {item.med.nome} {item.med.dosagem ? `(${item.med.dosagem})` : ''}
                                                    </h4>
                                                    <div className="flex flex-wrap gap-1.5 mt-0.5 items-center">
                                                        <span className="px-1.5 py-0.2 text-[8px] font-black uppercase rounded bg-pink-50 text-pink-700 border border-pink-200/60">
                                                            {item.med.categoria}
                                                        </span>
                                                        <span className="text-[9px] font-bold text-slate-500 font-mono">
                                                            Lote: {item.med.lote}
                                                        </span>
                                                        <span className="text-[9px] font-bold text-emerald-700 font-mono">
                                                            Estoque Disponível: {item.med.quantidade} {item.med.unidade}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Controle de Quantidade */}
                                            <div className="flex items-center gap-2 shrink-0">
                                                <div className="flex items-center bg-slate-100/90 border border-slate-200/80 rounded-xl p-1 shadow-inner">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUpdateItemQuantity(item.med.id, item.quantity - 1)}
                                                        className="w-6 h-6 rounded-lg bg-white hover:bg-pink-600 hover:text-white text-slate-700 flex items-center justify-center transition-colors active:scale-95 shadow-2xs font-bold cursor-pointer"
                                                    >
                                                        <Minus className="w-3 h-3" />
                                                    </button>
                                                    <input
                                                        type="number"
                                                        className="w-10 text-center text-xs font-black font-mono text-slate-900 bg-transparent outline-none"
                                                        value={item.quantity}
                                                        onChange={(e) => handleUpdateItemQuantity(item.med.id, parseInt(e.target.value, 10) || 1)}
                                                        min="1"
                                                        max={item.med.quantidade}
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUpdateItemQuantity(item.med.id, item.quantity + 1)}
                                                        className="w-6 h-6 rounded-lg bg-white hover:bg-pink-600 hover:text-white text-slate-700 flex items-center justify-center transition-colors active:scale-95 shadow-2xs font-bold cursor-pointer"
                                                    >
                                                        <Plus className="w-3 h-3" />
                                                    </button>
                                                </div>
                                                <span className="text-[10px] font-black text-slate-700 uppercase min-w-[20px]">
                                                    {item.med.unidade || 'un'}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveItem(item.med.id)}
                                                    className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-all cursor-pointer"
                                                    title="Remover medicamento"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Barra de Navegação Inferior */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between shrink-0">
                            <button
                                type="button"
                                onClick={() => navigateToTab('paciente')}
                                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" />
                                <span>Voltar: Paciente</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    if (selectedItems.length === 0) {
                                        showAlert('Adicione pelo menos um medicamento para prosseguir.', 'error');
                                        return;
                                    }
                                    navigateToTab('medico');
                                }}
                                disabled={selectedItems.length === 0}
                                className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-md ${
                                    selectedItems.length === 0
                                        ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none'
                                        : 'bg-gradient-to-r from-pink-600 via-rose-600 to-pink-600 hover:from-pink-500 hover:via-rose-500 hover:to-pink-500 text-white shadow-pink-600/25 active:scale-95 border border-pink-700/20'
                                }`}
                            >
                                <span>Avançar para Médico & Receita</span>
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}

                {/* ========================================================================= */}
                {/* 4. ABA: MÉDICO & RECEITA */}
                {/* ========================================================================= */}
                {selectedPatientObj && activeTab === 'medico' && (
                    <div className="flex-1 h-full min-h-0 bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs flex flex-col justify-between gap-3 overflow-hidden animate-in fade-in duration-200">
                        <div className="space-y-3.5 flex-1 overflow-y-auto pr-1 custom-scrollbar">
                            {/* Header da Aba */}
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-xl bg-pink-50 text-pink-600 border border-pink-100 shadow-2xs">
                                        <Stethoscope className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-slate-900 text-xs sm:text-sm uppercase tracking-tight">
                                            Médico Prescritor & Receita
                                        </h3>
                                        <p className="text-[10px] text-slate-400 font-semibold">
                                            Informe o CRM do médico prescritor e as instruções da receita
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Card 1: CRM do Médico e UF */}
                            <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-3.5 space-y-2">
                                <div className="grid grid-cols-12 gap-2.5">
                                    {/* CRM / Busca */}
                                    <div className="col-span-8 sm:col-span-9 relative">
                                        <div className="flex items-center justify-between mb-1 ml-0.5">
                                            <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1">
                                                <Stethoscope className="w-3.5 h-3.5 text-pink-600" />
                                                <span>CRM do Médico Prescritor *</span>
                                            </label>
                                            {medicoCrm && (
                                                <span className="text-[9px] font-black text-pink-600 font-mono bg-pink-50 px-1.5 py-0.2 rounded border border-pink-100 shadow-2xs">
                                                    CRM {medicoCrm}
                                                </span>
                                            )}
                                        </div>

                                        <div ref={medicoInputContainerRef} className="relative w-full">
                                            <input
                                                type="text"
                                                className="w-full rounded-xl border border-slate-300/90 bg-white py-2 pl-8 pr-7 text-xs font-bold text-slate-900 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 transition-all placeholder:text-slate-400 shadow-2xs font-mono"
                                                placeholder="Ex: 12345 ou busque por nome do médico..."
                                                value={medicoSearchQuery}
                                                onFocus={() => setShowMedicoDropdown(true)}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setMedicoSearchQuery(val);
                                                    setShowMedicoDropdown(true);

                                                    const parsed = parseCrmAndUfInput(val);
                                                    setMedicoCrm(parsed.crm);
                                                    if (parsed.uf && parsed.uf !== 'MG') {
                                                        setMedicoUf(parsed.uf);
                                                    }
                                                }}
                                                required
                                            />
                                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                            {medicoSearchQuery && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setMedicoSearchQuery('');
                                                        setMedicoCrm('');
                                                        setMedicoNome('');
                                                        setShowMedicoDropdown(false);
                                                    }}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                                                    title="Limpar CRM"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>

                                        {/* Dropdown de Sugestões de Médicos via Portal */}
                                        <FloatingDropdownPortal
                                            isOpen={showMedicoDropdown && medicoSuggestions.length > 0}
                                            targetRef={medicoInputContainerRef}
                                            onClose={() => setShowMedicoDropdown(false)}
                                        >
                                            <div className="divide-y divide-slate-100">
                                                {medicoSuggestions.map((sug, idx) => (
                                                    <button
                                                        key={`${sug.crm}_${sug.uf}_${idx}`}
                                                        type="button"
                                                        onMouseDown={(e) => {
                                                            e.preventDefault();
                                                            setMedicoCrm(sug.crm);
                                                            setMedicoUf(sug.uf || 'MG');
                                                            setMedicoNome(sug.nome || '');
                                                            setMedicoSearchQuery(sug.nome ? `${sug.nome} (CRM ${sug.crm})` : sug.crm);
                                                            setShowMedicoDropdown(false);
                                                        }}
                                                        className="w-full text-left px-3 py-2.5 hover:bg-pink-50 text-slate-800 text-xs font-bold flex items-center justify-between transition-colors group cursor-pointer"
                                                    >
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <div className="w-7 h-7 rounded-lg bg-pink-50 group-hover:bg-pink-600 group-hover:text-white text-pink-700 flex items-center justify-center shrink-0 transition-colors border border-pink-100">
                                                                <Stethoscope className="w-3.5 h-3.5" />
                                                            </div>
                                                            <div className="min-w-0">
                                                                <span className="font-black text-slate-900 block truncate group-hover:text-pink-900 text-xs uppercase">
                                                                    {sug.nome || `CRM ${sug.crm}/${sug.uf}`}
                                                                </span>
                                                                <span className="text-[10px] text-slate-500 font-mono font-semibold block mt-0.5">
                                                                    CRM {sug.crm}/{sug.uf} {sug.count > 0 ? `• ${sug.count} prescrições anteriores` : ''}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[9px] font-black uppercase font-mono shrink-0 group-hover:bg-pink-100 group-hover:text-pink-800">
                                                            {sug.uf}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        </FloatingDropdownPortal>
                                    </div>

                                    {/* Campo UF */}
                                    <div className="col-span-4 sm:col-span-3">
                                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1 block ml-0.5">
                                            UF *
                                        </label>
                                        <div className="relative">
                                            <select
                                                value={medicoUf}
                                                onChange={(e) => setMedicoUf(e.target.value.toUpperCase())}
                                                className="w-full rounded-xl border border-slate-300/90 bg-white py-2 pl-2.5 pr-6 text-xs font-black text-slate-900 outline-none focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 transition-all cursor-pointer font-mono uppercase shadow-2xs appearance-none"
                                                required
                                            >
                                                {ESTADOS_BRASIL.map(uf => (
                                                    <option key={uf} value={uf}>
                                                        {uf}
                                                    </option>
                                                ))}
                                            </select>
                                            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
                                        </div>
                                    </div>
                                </div>

                                {/* Badge do Médico Selecionado */}
                                {medicoNome && (
                                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-[10px] font-bold animate-in fade-in shadow-2xs">
                                        <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                        <span className="truncate">Médico Vinculado: <strong>{medicoNome}</strong> (CRM {medicoCrm}/{medicoUf})</span>
                                    </div>
                                )}
                            </div>

                            {/* Card 2: Observações / Receita */}
                            <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-3.5 space-y-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1">
                                        <FileText className="w-3.5 h-3.5 text-pink-600" />
                                        <span>Observações / Receita</span>
                                    </label>
                                    <span className="text-[9px] font-bold text-slate-400 uppercase">
                                        Instruções e posologia
                                    </span>
                                </div>

                                {/* Atalhos Rápidos */}
                                <div className="flex flex-wrap gap-1.5">
                                    {[
                                        'Uso Contínuo',
                                        'Receita Retida',
                                        'Validade 30 Dias',
                                        'Orientado(a)'
                                    ].map(tag => {
                                        const isIncluded = observacoes.includes(tag);
                                        return (
                                            <button
                                                key={tag}
                                                type="button"
                                                onClick={() => {
                                                    if (!observacoes.includes(tag)) {
                                                        setObservacoes(prev => prev ? `${prev} • ${tag}` : tag);
                                                    }
                                                }}
                                                className={`px-2.5 py-1 rounded-lg text-[9px] font-extrabold uppercase tracking-wider transition-all border active:scale-95 cursor-pointer flex items-center gap-1 ${
                                                    isIncluded 
                                                        ? 'bg-pink-100 border-pink-300 text-pink-800 shadow-2xs' 
                                                        : 'bg-white hover:bg-pink-50 hover:text-pink-700 text-slate-600 border-slate-200/80'
                                                }`}
                                            >
                                                <span>+</span>
                                                <span>{tag}</span>
                                            </button>
                                        );
                                    })}
                                </div>

                                <textarea
                                    className="w-full min-h-[70px] rounded-xl border border-slate-300/90 bg-white p-2.5 text-xs text-slate-900 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none transition-all font-medium placeholder:text-slate-400 resize-none custom-scrollbar shadow-2xs"
                                    placeholder="Digite anotações da receita, dosagens prescritas, recomendações repassadas ao paciente..."
                                    value={observacoes}
                                    onChange={(e) => setObservacoes(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Barra de Navegação Inferior */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between shrink-0">
                            <button
                                type="button"
                                onClick={() => navigateToTab('medicamentos')}
                                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" />
                                <span>Voltar: Medicamentos</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    if (!medicoCrm && !medicoSearchQuery) {
                                        showAlert('Informe o CRM do médico prescritor para continuar.', 'error');
                                        return;
                                    }
                                    navigateToTab('revisar');
                                }}
                                disabled={!medicoCrm && !medicoSearchQuery}
                                className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-md ${
                                    !medicoCrm && !medicoSearchQuery
                                        ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none'
                                        : 'bg-gradient-to-r from-pink-600 via-rose-600 to-pink-600 hover:from-pink-500 hover:via-rose-500 hover:to-pink-500 text-white shadow-pink-600/25 active:scale-95 border border-pink-700/20'
                                }`}
                            >
                                <span>Avançar para Revisão</span>
                                <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}

                {/* ========================================================================= */}
                {/* 5. ABA: REVISAR & FINALIZAR */}
                {/* ========================================================================= */}
                {selectedPatientObj && activeTab === 'revisar' && (
                    <div className="flex-1 h-full min-h-0 bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs flex flex-col justify-between gap-3 overflow-hidden animate-in fade-in duration-200">
                        <div className="space-y-3 flex-1 overflow-y-auto pr-1 custom-scrollbar">
                            {/* Header da Aba */}
                            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                <div className="flex items-center gap-2">
                                    <div className="p-1.5 rounded-xl bg-pink-50 text-pink-600 border border-pink-100 shadow-2xs">
                                        <ClipboardCheck className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-slate-900 text-xs sm:text-sm uppercase tracking-tight">
                                            Revisão Geral da Dispensação
                                        </h3>
                                        <p className="text-[10px] text-slate-400 font-semibold">
                                            Confira todas as informações antes de registrar a retirada no sistema
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Resumo do Paciente e Prescritor */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {/* Paciente */}
                                <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-3.5 space-y-1">
                                    <span className="text-[9px] font-black uppercase text-pink-600 tracking-wider">Beneficiário</span>
                                    <h4 className="font-black text-sm text-slate-900 uppercase truncate">
                                        {selectedPatientObj.name}
                                    </h4>
                                    <p className="text-xs font-mono font-bold text-slate-600">
                                        CPF: {selectedPatientObj.cpf ? selectedPatientObj.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") : (selectedPatientObj.sus_number || '')}
                                    </p>
                                    <p className="text-[10px] font-semibold text-slate-500">
                                        Bairro: {selectedPatientObj.neighborhood || '—'}
                                    </p>
                                </div>

                                {/* Médico */}
                                <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-3.5 space-y-1">
                                    <span className="text-[9px] font-black uppercase text-pink-600 tracking-wider">Médico Prescritor</span>
                                    <h4 className="font-black text-sm text-slate-900 uppercase truncate">
                                        {medicoNome || `CRM ${medicoCrm || medicoSearchQuery}/${medicoUf}`}
                                    </h4>
                                    <p className="text-xs font-mono font-bold text-slate-600">
                                        CRM: {medicoCrm || medicoSearchQuery} / {medicoUf}
                                    </p>
                                    <p className="text-[10px] font-semibold text-slate-500">
                                        Data do Atendimento: {formatDateTimeBr(withdrawalDate)}
                                    </p>
                                </div>
                            </div>

                            {/* Resumo dos Medicamentos */}
                            <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-3.5 space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[9.5px] font-black uppercase text-slate-700 tracking-wider">
                                        Medicamentos Selecionados ({selectedItems.length})
                                    </span>
                                </div>

                                <div className="divide-y divide-slate-200/70 bg-white rounded-xl border border-slate-200/70 overflow-hidden">
                                    {selectedItems.map((item, idx) => (
                                        <div key={item.med.id} className="p-2.5 flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2">
                                                <span className="w-5 h-5 rounded-md bg-pink-50 text-pink-700 font-black text-[9px] flex items-center justify-center">
                                                    #{idx + 1}
                                                </span>
                                                <div>
                                                    <span className="font-black text-slate-900 uppercase">
                                                        {item.med.nome} {item.med.dosagem ? `(${item.med.dosagem})` : ''}
                                                    </span>
                                                    <span className="text-[9px] text-slate-400 font-mono block">
                                                        Lote: {item.med.lote} • Cat: {item.med.categoria}
                                                    </span>
                                                </div>
                                            </div>
                                            <span className="font-black text-pink-600 text-xs font-mono bg-pink-50 px-2 py-0.5 rounded-lg border border-pink-100">
                                                {item.quantity} {item.med.unidade || 'un'}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Observações da Receita */}
                            {observacoes && observacoes.trim() && (
                                <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-3 space-y-1">
                                    <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider">Observações e Posologia</span>
                                    <p className="text-xs text-slate-700 font-semibold leading-relaxed whitespace-pre-line bg-white p-2.5 rounded-xl border border-slate-200/60">
                                        {observacoes}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Barra de Navegação e Confirmação */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between shrink-0">
                            <button
                                type="button"
                                onClick={() => navigateToTab('medico')}
                                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" />
                                <span>Voltar para Ajustar</span>
                            </button>

                            <button
                                type="button"
                                onClick={handleConfirmSubmit}
                                disabled={saving || selectedItems.length === 0}
                                className={`px-6 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-md ${
                                    saving || selectedItems.length === 0
                                        ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none'
                                        : 'bg-gradient-to-r from-pink-600 via-rose-600 to-pink-600 hover:from-pink-500 hover:via-rose-500 hover:to-pink-500 text-white shadow-pink-600/30 hover:shadow-lg hover:shadow-pink-600/40 active:scale-98 border border-pink-700/20'
                                }`}
                            >
                                {saving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Gravando Retirada...</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="w-4 h-4" />
                                        <span>Confirmar Retirada ({selectedItems.length} {selectedItems.length === 1 ? 'item' : 'itens'})</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ========================================================================= */}
            {/* MODAIS AUXILIARES (HISTÓRICO, CADASTRO, SUCESSO, CATÁLOGO, ETC.) */}
            {/* ========================================================================= */}

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
                                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-500 transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Form Body */}
                        <form
                            onSubmit={async (e) => {
                                e.preventDefault();
                                if (!newPatientName || !pendingCpf || !newPatientBirthDate || !newPatientCity || !newPatientPhone.trim() || !newPatientAgenteSaude.trim()) {
                                    showAlert('Por favor, preencha todos os campos obrigatórios (*).', 'error');
                                    return;
                                }
                                const cleanPhone = newPatientPhone.replace(/\D/g, '');
                                if (cleanPhone.length < 10) {
                                    showAlert('O telefone deve conter DDD + Número (mínimo 10 dígitos).', 'error');
                                    return;
                                }
                                setRegistering(true);
                                try {
                                    const created = await createPaciente({
                                        name: newPatientName,
                                        nickname: newPatientNickname.trim() || null,
                                        cpf: pendingCpf.replace(/\D/g, ''),
                                        birth_date: newPatientBirthDate,
                                        phone: newPatientPhone,
                                        neighborhood: newPatientNeighborhood,
                                        street: newPatientStreet,
                                        city: newPatientCity,
                                        sus_number: newPatientSusNumber.trim() || null,
                                        agente_saude: newPatientAgenteSaude.trim() || null
                                    });
                                    setPacientes(prev => [...prev, created]);
                                    selectAndValidatePatient(created);
                                    setIsRegModalOpen(false);
                                    showAlert('Paciente cadastrado com sucesso!', 'success');
                                } catch (error) {
                                    console.error('Erro ao cadastrar paciente:', error);
                                    showAlert('Erro ao cadastrar paciente.', 'error');
                                } finally {
                                    setRegistering(false);
                                }
                            }}
                            className="p-6 space-y-4 overflow-y-auto max-h-[75vh] custom-scrollbar"
                        >
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1">
                                        Nome Completo *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full rounded-xl border border-slate-300 p-2.5 text-xs uppercase font-bold text-slate-900 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none"
                                        placeholder="NOME DO PACIENTE"
                                        value={newPatientName}
                                        onChange={(e) => setNewPatientName(e.target.value.toUpperCase())}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1">
                                        Apelido / Como gosta de ser chamado
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full rounded-xl border border-slate-300 p-2.5 text-xs uppercase font-bold text-slate-900 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none"
                                        placeholder="EX: DONA MARIA"
                                        value={newPatientNickname}
                                        onChange={(e) => setNewPatientNickname(e.target.value.toUpperCase())}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1">
                                        CPF *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-mono font-bold text-slate-900 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none"
                                        value={pendingCpf}
                                        onChange={(e) => setPendingCpf(formatCpfMask(e.target.value))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1">
                                        Data de Nascimento *
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold text-slate-900 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none"
                                        value={newPatientBirthDate}
                                        onChange={(e) => setNewPatientBirthDate(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1">
                                        Telefone / WhatsApp *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold text-slate-900 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none"
                                        placeholder="(31) 90000-0000"
                                        value={newPatientPhone}
                                        onChange={(e) => handlePhoneChange(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1">
                                        Cartão Nacional do SUS (15 dígitos)
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-mono font-bold text-slate-900 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none"
                                        placeholder="000 0000 0000 0000"
                                        value={newPatientSusNumber}
                                        onChange={(e) => setNewPatientSusNumber(e.target.value.replace(/\D/g, '').slice(0, 15))}
                                    />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1">
                                        Agente de Saúde Responsável *
                                    </label>
                                    <select
                                        required
                                        className="w-full rounded-xl border border-slate-300 p-2.5 text-xs font-bold text-slate-900 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none uppercase bg-white cursor-pointer"
                                        value={newPatientAgenteSaude}
                                        onChange={(e) => setNewPatientAgenteSaude(e.target.value)}
                                    >
                                        <option value="">Selecione o agente de saúde...</option>
                                        {(agentesSaudeItems && agentesSaudeItems.length > 0 ? agentesSaudeItems.map(a => a.nome) : AGENTES_DE_SAUDE).map(a => (
                                            <option key={a} value={a}>{a}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1">
                                        Bairro *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full rounded-xl border border-slate-300 p-2.5 text-xs uppercase font-bold text-slate-900 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none"
                                        placeholder="BAIRRO DO PACIENTE"
                                        value={newPatientNeighborhood}
                                        onChange={(e) => setNewPatientNeighborhood(e.target.value.toUpperCase())}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1">
                                        Rua / Endereço *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full rounded-xl border border-slate-300 p-2.5 text-xs uppercase font-bold text-slate-900 focus:border-pink-500 focus:ring-2 focus:ring-pink-500/10 outline-none"
                                        placeholder="RUA, NÚMERO, COMPLEMENTO"
                                        value={newPatientStreet}
                                        onChange={(e) => setNewPatientStreet(e.target.value.toUpperCase())}
                                    />
                                </div>
                            </div>

                            <div className="p-4 bg-slate-50 border-t border-slate-100 -mx-6 -mb-6 mt-6 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsRegModalOpen(false)}
                                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs uppercase rounded-xl transition-all cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={registering}
                                    className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs uppercase rounded-xl transition-all shadow-md active:scale-95 flex items-center gap-1.5 cursor-pointer"
                                >
                                    {registering ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                                    <span>Salvar e Selecionar</span>
                                </button>
                            </div>
                        </form>
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
                                        handleResetPatient();
                                    }}
                                    className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs uppercase tracking-wider rounded-2xl transition-all active:scale-98 cursor-pointer"
                                >
                                    Nova Dispensação
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
                <div className="fixed inset-0 z-[130] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[88vh] overflow-hidden border border-slate-200/80 flex flex-col animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-pink-50/80 via-white to-rose-50/50 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-600 to-rose-500 text-white flex items-center justify-center shadow-md shadow-pink-500/25 ring-4 ring-pink-50 shrink-0">
                                    <Pill className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-black text-slate-900 uppercase text-xs md:text-sm tracking-tight">
                                            Catálogo de Medicamentos
                                        </h3>
                                        <span className="px-2 py-0.5 rounded-full bg-pink-100 text-pink-700 text-[9px] font-black uppercase">
                                            {selectedItems.length} selecionado{selectedItems.length === 1 ? '' : 's'}
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                                        Pesquise no catálogo e ajuste as quantidades para dispensar
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsMedModalOpen(false)}
                                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-all cursor-pointer"
                                title="Fechar Catálogo"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Search and Category filters */}
                        <div className="p-4 bg-white border-b border-slate-100 space-y-3 shrink-0">
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Buscar por nome, princípio ativo, lote..."
                                    className="w-full pl-10 pr-9 py-2.5 border border-slate-300/90 bg-slate-50/50 hover:bg-white focus:bg-white rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-pink-500 focus:ring-4 focus:ring-pink-500/10 transition-all placeholder:text-slate-400 shadow-2xs"
                                    value={medModalSearch}
                                    onChange={(e) => setMedModalSearch(e.target.value)}
                                    autoFocus
                                />
                                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                {medModalSearch && (
                                    <button
                                        type="button"
                                        onClick={() => setMedModalSearch('')}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer p-0.5"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>

                            {/* Categories tabs */}
                            <div className="flex gap-1.5 overflow-x-auto custom-scrollbar pb-0.5">
                                {(['TODOS', 'CBAF', 'CESAF', 'CEAF'] as const).map(cat => (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => setMedModalCategory(cat)}
                                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                                            medModalCategory === cat
                                                ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white shadow-sm shadow-pink-600/20 scale-102'
                                                : 'bg-slate-100/90 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 custom-scrollbar min-h-0 bg-slate-50/40">
                            {!medModalSearch.trim() ? (
                                <div className="py-16 flex flex-col items-center justify-center text-slate-400 text-center">
                                    <div className="w-14 h-14 rounded-2xl bg-pink-50 text-pink-400 flex items-center justify-center mb-3 shadow-2xs border border-pink-100">
                                        <Search className="w-7 h-7 animate-pulse" />
                                    </div>
                                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Digite um termo para pesquisar</h4>
                                    <p className="text-[11px] text-slate-400 text-center mt-1 font-semibold max-w-xs leading-relaxed">
                                        Informe o nome do medicamento, princípio ativo ou lote acima para listar os itens disponíveis.
                                    </p>
                                </div>
                            ) : modalMedOptions.length > 0 ? (
                                modalMedOptions.map(med => {
                                    const isLowStock = med.quantidade <= med.limite_minimo;
                                    const qtyBadgeColor = med.quantidade === 0 
                                        ? 'bg-rose-50 text-rose-700 border-rose-200' 
                                        : isLowStock 
                                            ? 'bg-amber-50 text-amber-800 border-amber-200' 
                                            : 'bg-emerald-50 text-emerald-800 border-emerald-200';

                                    const isExpired = new Date(med.validade).getTime() <= Date.now();
                                    const existing = selectedItems.find(si => si.med.id === med.id);
                                    const isSelected = !!existing;

                                    return (
                                        <div
                                            key={med.id}
                                            className={`w-full p-3.5 rounded-2xl border transition-all flex flex-col gap-2 relative overflow-hidden ${
                                                isSelected 
                                                    ? 'border-pink-500 bg-pink-50/50 shadow-md shadow-pink-500/10 ring-2 ring-pink-500/20' 
                                                    : 'border-slate-200/90 hover:border-pink-300 hover:bg-white bg-white shadow-2xs hover:shadow-xs'
                                            }`}
                                        >
                                            {isSelected && (
                                                <div className="absolute top-0 right-0 bg-gradient-to-r from-pink-600 to-rose-600 text-white text-[9px] font-black uppercase px-3 py-1 rounded-bl-xl shadow-xs flex items-center gap-1">
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    <span>Selecionado ({existing.quantity} {med.unidade})</span>
                                                </div>
                                            )}

                                            <div className="flex justify-between items-start w-full pr-24">
                                                <div>
                                                    <h4 className="font-black text-xs md:text-sm uppercase text-slate-900 flex items-center gap-2">
                                                        {med.nome} {med.dosagem ? `(${med.dosagem})` : ''}
                                                    </h4>
                                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                                        <span className="px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-md bg-pink-50 text-pink-700 border border-pink-200/60">
                                                            {med.categoria}
                                                        </span>
                                                        {med.tipo && (
                                                            <span className="px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded-md bg-slate-100 text-slate-600 border border-slate-200">
                                                                {med.tipo}
                                                            </span>
                                                        )}
                                                        {med.principio_ativo && (
                                                            <span className="px-2 py-0.5 text-[8px] font-extrabold uppercase tracking-wider rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                                                                P.Ativo: {med.principio_ativo}
                                                            </span>
                                                        )}
                                                        <span className="px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded-md bg-slate-50 border border-slate-200 text-slate-600 font-mono">
                                                            Lote: {med.lote}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between text-[10px] text-slate-500 border-t border-slate-100 pt-2 mt-0.5">
                                                <div className="flex items-center gap-3">
                                                    <span className="font-semibold text-slate-600">
                                                        Validade: <span className={isExpired ? 'text-rose-600 font-black' : 'font-bold text-slate-800'}>
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
                                                        className={`px-3.5 py-1.5 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-xl transition-all shadow-xs active:scale-95 flex items-center gap-1 cursor-pointer ${
                                                            isSelected 
                                                                ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-600/20' 
                                                                : 'bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 shadow-pink-600/20'
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
                                <div className="py-12 flex flex-col items-center justify-center text-slate-400 text-center">
                                    <Search className="w-12 h-12 mb-2 opacity-20 text-slate-500" />
                                    <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Nenhum medicamento encontrado</h4>
                                    <p className="text-[10px] text-slate-400 text-center mt-0.5 font-medium">
                                        Não encontramos resultados para "{medModalSearch}". Tente alterar os termos de busca ou a categoria.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 bg-white border-t border-slate-100 flex justify-between items-center shrink-0">
                            <span className="text-xs font-extrabold text-slate-700">
                                {selectedItems.length} {selectedItems.length === 1 ? 'medicamento selecionado' : 'medicamentos selecionados'}
                            </span>
                            <button
                                type="button"
                                onClick={() => setIsMedModalOpen(false)}
                                className="px-5 py-2.5 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-pink-600/20 active:scale-95 cursor-pointer"
                            >
                                Concluir Seleção
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE QUANTIDADE DESEJADA */}
            {qtyModalMed && (
                <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200/80 flex flex-col animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-pink-50/90 via-rose-50/40 to-white flex justify-between items-start">
                            <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                    <span className="px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-md bg-pink-600 text-white shadow-2xs">
                                        {qtyModalMed.categoria}
                                    </span>
                                    {qtyModalMed.dosagem && (
                                        <span className="px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider rounded-md bg-pink-100 text-pink-800">
                                            {qtyModalMed.dosagem}
                                        </span>
                                    )}
                                </div>
                                <h3 className="font-black text-slate-900 text-base uppercase leading-tight pt-1">
                                    {qtyModalMed.nome}
                                </h3>
                                <p className="text-[11px] text-slate-500 font-semibold flex items-center gap-2 pt-0.5">
                                    <span>Lote: <strong className="font-mono font-bold text-slate-700">{qtyModalMed.lote}</strong></span>
                                    <span>•</span>
                                    <span>Estoque: <strong className="text-emerald-700 font-black">{qtyModalMed.quantidade} {qtyModalMed.unidade}</strong></span>
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setQtyModalMed(null)}
                                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Body: Input de quantidade */}
                        <div className="p-6 space-y-4 bg-slate-50/30">
                            <label className="block text-xs font-black uppercase tracking-wider text-slate-600 text-center">
                                Informe a quantidade desejada a dispensar
                            </label>

                            <div className="flex items-center justify-center gap-3">
                                <button
                                    type="button"
                                    onClick={() => setQtyInput(prev => Math.max(1, prev - 1))}
                                    disabled={qtyInput <= 1}
                                    className="w-12 h-12 rounded-2xl bg-white hover:bg-slate-100 active:scale-95 disabled:opacity-40 text-slate-700 flex items-center justify-center font-extrabold text-lg transition-all shadow-sm border border-slate-200 cursor-pointer"
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
                                        className="w-32 py-3 px-3 border-2 border-pink-500 rounded-2xl text-center text-2xl font-black font-mono text-slate-900 bg-white focus:outline-none focus:ring-4 focus:ring-pink-500/20 shadow-inner"
                                    />
                                    <span className="block text-[10px] font-black uppercase text-slate-400 text-center mt-1">
                                        {qtyModalMed.unidade || 'Unidades'}
                                    </span>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setQtyInput(prev => Math.min(qtyModalMed.quantidade, prev + 1))}
                                    disabled={qtyInput >= qtyModalMed.quantidade}
                                    className="w-12 h-12 rounded-2xl bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 active:scale-95 disabled:opacity-40 text-white flex items-center justify-center font-extrabold text-lg transition-all shadow-md shadow-pink-600/30 cursor-pointer"
                                >
                                    <Plus className="w-5 h-5" />
                                </button>
                            </div>

                            {qtyInput >= qtyModalMed.quantidade && (
                                <p className="text-[10px] font-bold text-amber-700 text-center bg-amber-50 py-1.5 px-3 rounded-xl border border-amber-200/80 shadow-2xs">
                                    Limite máximo disponível no estoque atingido ({qtyModalMed.quantidade} {qtyModalMed.unidade})
                                </p>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 bg-white border-t border-slate-100 flex gap-3">
                            <button
                                type="button"
                                onClick={() => setQtyModalMed(null)}
                                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmQuantity}
                                className="flex-1 py-3 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white font-black text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-pink-600/30 active:scale-95 cursor-pointer"
                            >
                                Confirmar Quantidade
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL DE VALIDAÇÃO AUTOMÁTICA DE CADASTRO INCOMPLETO */}
            <CadastroIncompletoModal
                isOpen={isValidationModalOpen}
                patient={incompletePatient}
                onClose={() => {
                    setIsValidationModalOpen(false);
                    setIncompletePatient(null);
                    if (!selectedPatientObj) {
                        setPatientName('');
                        setPatientCpf('');
                        setIsPatientUnlocked(false);
                    }
                }}
                onComplete={handlePatientValidationComplete}
                accentColor="pink"
                contextTitle="Dispensação de Medicamentos"
            />
        </div>
    );
};
