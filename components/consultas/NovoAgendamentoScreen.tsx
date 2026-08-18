import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { User, ConsultaPaciente, ConsultaProcedimento, AppState, ConsultaAgendamento, ConsultaVaga, AGENTES_DE_SAUDE } from '../../types';
import { 
    ArrowLeft, 
    UserPlus, 
    Search, 
    Check, 
    AlertTriangle, 
    CalendarDays, 
    Loader2, 
    User as UserIcon, 
    CheckCircle2, 
    Ticket, 
    Activity, 
    Plus, 
    Calendar,
    Clock,
    Users,
    FileDown,
    X,
    ChevronLeft,
    ChevronRight,
    Sparkles,
    Info,
    ChevronDown
} from 'lucide-react';
import * as db from '../../services/consultasService';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { ConsultaPdfGenerator } from './ConsultaPdfGenerator';

const formatPatientName = (patient?: ConsultaPaciente | null) => {
    if (!patient) return '';
    return patient.nickname ? `${patient.name} (${patient.nickname})` : patient.name;
};

const calculateAge = (birthDateStr?: string) => {
    if (!birthDateStr) return '';
    const birthDate = new Date(birthDateStr + 'T00:00:00');
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age >= 0 ? `${age} anos` : '';
};

interface NovoAgendamentoScreenProps {
    currentUser: User;
    onBack: () => void;
    onNavigate: (view: string) => void;
    subView?: string;
    appState: AppState;
}

export const NovoAgendamentoScreen: React.FC<NovoAgendamentoScreenProps> = ({
    currentUser,
    onBack,
    onNavigate,
    subView,
    appState
}) => {
    // Step state
    const [step, setStep] = useState<1 | 2 | 3>(1);
    
    // Sync subView route with step
    useEffect(() => {
        if (subView === 'novo-agendamento-paciente') setStep(1);
        else if (subView === 'novo-agendamento-procedimento') setStep(2);
        else if (subView === 'novo-agendamento-revisao') setStep(3);
    }, [subView]);
    
    // Loading states
    const [loading, setLoading] = useState(false);
    const [searching, setSearching] = useState(false);
    
    // Step 1: Patient States
    const [patientQuery, setPatientQuery] = useState('');
    const [patientResults, setPatientResults] = useState<ConsultaPaciente[]>([]);
    const [selectedPatient, setSelectedPatient] = useState<ConsultaPaciente | null>(null);
    const [patientHistory, setPatientHistory] = useState<ConsultaAgendamento[]>([]);
    const [isRegistering, setIsRegistering] = useState(false);

    // Fetch patient history when selectedPatient changes
    useEffect(() => {
        if (selectedPatient) {
            db.getPacienteHistory(selectedPatient.id)
                .then(setPatientHistory)
                .catch(err => console.error("Error fetching patient history:", err));
        } else {
            setPatientHistory([]);
        }
    }, [selectedPatient]);
    
    // Register Patient Form
    const [newPatientName, setNewPatientName] = useState('');
    const [newPatientNickname, setNewPatientNickname] = useState('');
    const [newPatientCpf, setNewPatientCpf] = useState('');
    const [newPatientBirthDate, setNewPatientBirthDate] = useState('');
    const [newPatientPhone, setNewPatientPhone] = useState('');
    const [newPatientNeighborhood, setNewPatientNeighborhood] = useState('');
    const [newPatientStreet, setNewPatientStreet] = useState('');
    const [newPatientCity, setNewPatientCity] = useState('SÃO JOSÉ DO GOIABAL -MG');
    const [newPatientSusNumber, setNewPatientSusNumber] = useState('');
    const [newPatientAgenteSaude, setNewPatientAgenteSaude] = useState('');
    const [cpfError, setCpfError] = useState('');
    const [showCpfNotFoundModal, setShowCpfNotFoundModal] = useState(false);
    const [unregisteredCpf, setUnregisteredCpf] = useState('');

    // Step 2: Booking Details States
    const [procedures, setProcedures] = useState<ConsultaProcedimento[]>([]);
    const [selectedProcedure, setSelectedProcedure] = useState<ConsultaProcedimento | null>(null);
    const [bookingDate, setBookingDate] = useState('');
    const [bookingQty, setBookingQty] = useState(1);
    const [bookingPriority, setBookingPriority] = useState<'Normal' | 'Urgência'>('Normal');
    const [procedureQuery, setProcedureQuery] = useState('');
    const [solicitationDate, setSolicitationDate] = useState(() => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    });

    // Submission States
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [createdBooking, setCreatedBooking] = useState<ConsultaAgendamento | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);
    const [gestorUserIds, setGestorUserIds] = useState<string[]>([]);

    const [activeDateDropdownId, setActiveDateDropdownId] = useState<string | null>(null);
    const [activeTimeDropdownId, setActiveTimeDropdownId] = useState<string | null>(null);
    const [printingBooking, setPrintingBooking] = useState<ConsultaAgendamento | null>(null);
    const [conflictBooking, setConflictBooking] = useState<ConsultaAgendamento | null>(null);
    const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);

    // Custom Vagas Calendar Picker States & Helpers
    const [vagas, setVagas] = useState<ConsultaVaga[]>([]);
    const [procedureBookings, setProcedureBookings] = useState<ConsultaAgendamento[]>([]);
    const [loadingVagas, setLoadingVagas] = useState(false);
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
    const [isSolicitationCalendarOpen, setIsSolicitationCalendarOpen] = useState(false);
    const [solicitationCalendarMonth, setSolicitationCalendarMonth] = useState<Date>(new Date());
    const [bookingTime, setBookingTime] = useState('');
    const [activeDate, setActiveDate] = useState('');

    // Check if appointment date falls in the last 7 days of its month
    const isLastWeekOfMonth = (dateStr: string): boolean => {
        if (!dateStr) return false;
        const date = new Date(dateStr + 'T12:00:00'); // Use noon to avoid timezone shift issues
        const currentMonth = date.getMonth();
        
        // Add 7 days
        const nextWeek = new Date(date);
        nextWeek.setDate(nextWeek.getDate() + 7);
        
        return nextWeek.getMonth() !== currentMonth;
    };

    // Get available slots based on priority and date
    const getAvailableSlots = (proc: ConsultaProcedimento, priority: 'Normal' | 'Urgência', dateStr: string): number => {
        if (!proc) return 0;
        return Math.max(0, proc.available_quantity);
    };

    // Check if procedure is waitlist-only (0 available vacancies for the selected procedure under chosen priority)
    const isWaitlistOnly = selectedProcedure !== null && 
        getAvailableSlots(selectedProcedure, bookingPriority, '') === 0;

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDayIndex = new Date(year, month, 1).getDay();
        const totalDays = new Date(year, month + 1, 0).getDate();
        
        const days = [];
        for (let i = 0; i < firstDayIndex; i++) {
            days.push(null);
        }
        for (let i = 1; i <= totalDays; i++) {
            days.push(new Date(year, month, i));
        }
        return days;
    };

    const formatDateToYYYYMMDD = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const getDateVagasInfo = (dateStr: string) => {
        const slotsForDate = vagas.filter(v => v.data === dateStr);
        if (slotsForDate.length === 0) return { exists: false, availableCount: 0, totalCount: 0 };
        const availableCount = slotsForDate.filter(v => v.status === 'Disponível').length;
        return {
            exists: true,
            availableCount,
            totalCount: slotsForDate.length
        };
    };

    // Fetch vagas and bookings when procedure changes
    useEffect(() => {
        if (selectedProcedure) {
            setLoadingVagas(true);
            Promise.all([
                db.getVagas(selectedProcedure.id),
                db.getAgendamentos({ procedimentoId: selectedProcedure.id })
            ])
                .then(([vagasData, bookingsData]) => {
                    setVagas(vagasData);
                    setProcedureBookings(bookingsData);
                    // Do NOT default bookingDate/time so that field starts empty
                    setBookingDate('');
                    setBookingTime('');
                    setActiveDate('');
                    if (vagasData.length > 0) {
                        setCurrentMonth(new Date(vagasData[0].data + 'T12:00:00'));
                    } else {
                        setCurrentMonth(new Date());
                    }
                })
                .catch(err => {
                    console.error("Error fetching vagas and bookings:", err);
                })
                .finally(() => {
                    setLoadingVagas(false);
                });
        } else {
            setVagas([]);
            setProcedureBookings([]);
            setBookingDate('');
            setBookingTime('');
            setActiveDate('');
        }
    }, [selectedProcedure]);





    // Load active procedures on mount
    useEffect(() => {
        const fetchProcedures = async () => {
            const data = await db.getProcedimentos(true); // only active
            setProcedures(data);
        };
        fetchProcedures();
    }, []);

    useEffect(() => {
        const fetchGestores = async () => {
            try {
                const gestores = await db.getConsultasGestores();
                setGestorUserIds(gestores);
            } catch (err) {
                console.error('Error fetching gestores in NovoAgendamentoScreen:', err);
            }
        };
        fetchGestores();
    }, []);

    const isAdmin = currentUser.role === 'admin';
    const isGestor = gestorUserIds.includes(currentUser.id);
    const canSeeSlots = isAdmin || isGestor;

    useEffect(() => {
        const handleOutsideClick = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.closest('.dropdown-container')) {
                setActiveDateDropdownId(null);
                setActiveTimeDropdownId(null);
            }
        };
        document.addEventListener('click', handleOutsideClick);
        return () => document.removeEventListener('click', handleOutsideClick);
    }, []);



    // Format CPF Input: 000.000.000-00
    const handleCpfChange = (val: string) => {
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
        setNewPatientCpf(formatted);
        setCpfError('');
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

    // CPF Validation algorithm
    const validateCPF = (cpf: string): boolean => {
        const cleanCpf = cpf.replace(/\D/g, '');
        if (cleanCpf.length !== 11) return false;
        
        // Repetitive numbers
        if (/^(\d)\1+$/.test(cleanCpf)) return false;

        let sum = 0;
        let remainder;

        for (let i = 1; i <= 9; i++) {
            sum += parseInt(cleanCpf.substring(i - 1, i)) * (11 - i);
        }

        remainder = (sum * 10) % 11;
        if (remainder === 10 || remainder === 11) remainder = 0;
        if (remainder !== parseInt(cleanCpf.substring(9, 10))) return false;

        sum = 0;
        for (let i = 1; i <= 10; i++) {
            sum += parseInt(cleanCpf.substring(i - 1, i)) * (12 - i);
        }

        remainder = (sum * 10) % 11;
        if (remainder === 10 || remainder === 11) remainder = 0;
        if (remainder !== parseInt(cleanCpf.substring(10, 11))) return false;

        return true;
    };

    // Patient Search
    useEffect(() => {
        const delayDebounceFn = setTimeout(async () => {
            if (patientQuery.trim().length >= 3) {
                setSearching(true);
                const query = patientQuery.toLowerCase();
                const allPatients = await db.getPacientes();
                
                // Filter by name, nickname, CPF or SUS number
                const results = allPatients.filter(p => 
                    p.name.toLowerCase().includes(query) || 
                    (p.nickname || '').toLowerCase().includes(query) ||
                    p.cpf.includes(query.replace(/\D/g, '')) ||
                    (p.sus_number || '').includes(query.replace(/\D/g, ''))
                );
                
                setPatientResults(results);
                setSearching(false);

                // Ao pesquisar um CPF de 11 dígitos não cadastrado, deve abrir o modal de cadastro imediatamente
                const cleanQuery = query.replace(/\D/g, '');
                if (cleanQuery.length === 11) {
                    const found = results.find(p => p.cpf.replace(/\D/g, '') === cleanQuery);
                    if (found) {
                        setSelectedPatient(found);
                    } else {
                        const formattedCpf = `${cleanQuery.slice(0, 3)}.${cleanQuery.slice(3, 6)}.${cleanQuery.slice(6, 9)}-${cleanQuery.slice(9, 11)}`;
                        setNewPatientCpf(formattedCpf);
                        setUnregisteredCpf(formattedCpf);
                        setShowCpfNotFoundModal(true);
                    }
                }
            } else {
                setPatientResults([]);
            }
        }, 300);

        return () => clearTimeout(delayDebounceFn);
    }, [patientQuery]);

    // Handle register patient
    const handleRegisterPatient = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage('');
        
        if (!newPatientName.trim()) {
            setErrorMessage('Nome completo é obrigatório.');
            return;
        }
        if (!validateCPF(newPatientCpf)) {
            setCpfError('CPF inválido.');
            setErrorMessage('Por favor, digite um CPF válido.');
            return;
        }
        if (!newPatientBirthDate) {
            setErrorMessage('Data de nascimento é obrigatória.');
            return;
        }

        setLoading(true);
        try {
            const newPatient = await db.createPaciente({
                name: newPatientName,
                nickname: newPatientNickname.trim() || null,
                cpf: newPatientCpf,
                birth_date: newPatientBirthDate,
                phone: newPatientPhone.trim() || null,
                neighborhood: newPatientNeighborhood.trim() || null,
                street: newPatientStreet.trim() || null,
                city: newPatientCity.trim() || null,
                sus_number: newPatientSusNumber.trim() || null,
                agente_saude: newPatientAgenteSaude.trim() || null
            });

            if (newPatient) {
                setSelectedPatient(newPatient);
                setIsRegistering(false);
                setShowCpfNotFoundModal(false);
                setNewPatientName('');
                setNewPatientNickname('');
                setNewPatientCpf('');
                setNewPatientBirthDate('');
                setNewPatientPhone('');
                setNewPatientNeighborhood('');
                setNewPatientStreet('');
                setNewPatientCity('SÃO JOSÉ DO GOIABAL -MG');
                setNewPatientSusNumber('');
                setNewPatientAgenteSaude('');
                setCpfError('');
                setPatientQuery('');
                onNavigate('consultas:novo-agendamento-paciente');
            }
        } catch (err: any) {
            setErrorMessage(err.message || 'Erro ao cadastrar paciente.');
        } finally {
            setLoading(false);
        }
    };

    const createNewBooking = async () => {
        if (!selectedPatient || !selectedProcedure) return;
        const targetDate = bookingDate || formatDateToYYYYMMDD(new Date());
        setLoading(true);
        
        // Determine status based on slot availability
        const availableSlots = getAvailableSlots(selectedProcedure, bookingPriority, targetDate);
        
        // Se for usuário comum, vai sempre como Fila de Espera
        const targetStatus = (!canSeeSlots)
            ? ('Fila de espera' as const)
            : (bookingDate && availableSlots >= bookingQty)
                ? ('Solicitado' as const) 
                : ('Fila de espera' as const);

        const optimisticBooking = {
            patient_id: selectedPatient.id,
            procedimento_id: selectedProcedure.id,
            appointment_date: canSeeSlots ? targetDate : undefined,
            appointment_time: (canSeeSlots && bookingDate && !isWaitlistOnly) ? (bookingTime || undefined) : undefined,
            solicitation_date: solicitationDate,
            quantity: bookingQty,
            priority: bookingPriority,
            status: targetStatus,
            created_by: currentUser.id
        };

        try {
            const result = await db.createAgendamento(optimisticBooking);
            setCreatedBooking(result);
            setSuccessMessage(
                targetStatus === 'Fila de espera'
                ? 'Paciente inserido na fila de espera com sucesso!'
                : 'Agendamento realizado com sucesso!'
            );
        } catch (err: any) {
            console.error("Erro ao criar agendamento:", err);
            setErrorMessage(err.message || 'Erro ao realizar agendamento.');
        } finally {
            setLoading(false);
        }
    };

    const handleRescheduleConflict = async () => {
        const targetDate = bookingDate || formatDateToYYYYMMDD(new Date());
        if (!conflictBooking || !targetDate || !selectedProcedure) return;
        setIsConflictModalOpen(false);
        setLoading(true);
        try {
            // Determine target status: check if slots are available on the new date
            const availableSlots = isWaitlistOnly ? 0 : getAvailableSlots(selectedProcedure, bookingPriority, targetDate);
            const targetStatus = availableSlots > 0 ? 'Agendado' : 'Fila de espera';

            const result = await db.updateAgendamentoDateAndStatus(conflictBooking.id, targetDate, targetStatus);
            if (result) {
                setCreatedBooking(result);
                setSuccessMessage(
                    targetStatus === 'Agendado'
                    ? 'Agendamento existente atualizado e confirmado para a nova data mais próxima com sucesso!'
                    : 'Agendamento existente atualizado e direcionado para a fila de espera na nova data com sucesso!'
                );
            } else {
                throw new Error('Falha ao atualizar agendamento.');
            }
        } catch (err: any) {
            setErrorMessage(err.message || 'Erro ao atualizar agendamento.');
        } finally {
            setLoading(false);
            setConflictBooking(null);
        }
    };

    // Handle Schedule Submission
    const handleConfirmBooking = async () => {
        if (!selectedPatient || !selectedProcedure) return;
        const targetDate = bookingDate || formatDateToYYYYMMDD(new Date());
        
        setErrorMessage('');
        setLoading(true);
        
        try {
            // Only run check if priority is Normal
            const isUrgent = bookingPriority === 'Urgência';
            
            if (!isUrgent) {
                try {
                    // Fetch patient history to check for active same-procedure bookings within 15 days
                    const history = await db.getPacienteHistory(selectedPatient.id);
                    
                    // Find any active/pending booking for the same procedure that is within 15 days of the proposed date
                    // and is NOT an urgency or retorno
                    const activeConflict = history.find(h => {
                        if (h.procedimento_id !== selectedProcedure.id) return false;
                        
                        const isActive = ['Solicitado', 'Agendado', 'Aguardando Data', 'Fila de espera'].includes(h.status);
                        if (!isActive) return false;
                        
                        const isExc = h.priority === 'Urgência' || h.status === 'Retorno' || h.is_retorno === true;
                        if (isExc) return false;

                        // Calculate days difference
                        const d1 = new Date(h.appointment_date + 'T12:00:00');
                        const d2 = new Date(targetDate + 'T12:00:00');
                        const diffTime = Math.abs(d1.getTime() - d2.getTime());
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        
                        return diffDays <= 15;
                    });

                    if (activeConflict) {
                        const existingDate = new Date(activeConflict.appointment_date + 'T12:00:00');
                        const newDate = new Date(targetDate + 'T12:00:00');
                        
                        if (newDate.getTime() < existingDate.getTime()) {
                            // Proposed date is closer! Show modal to reschedule
                            setConflictBooking(activeConflict);
                            setIsConflictModalOpen(true);
                            setLoading(false);
                            return;
                        } else {
                            // Existing date is closer! Block booking
                            const formattedOldDate = new Date(activeConflict.appointment_date + 'T00:00:00').toLocaleDateString('pt-BR');
                            setErrorMessage(`Não é permitido ter dois agendamentos ativos para o mesmo procedimento no período de 15 dias. O agendamento mais próximo (em ${formattedOldDate}) foi mantido.`);
                            setLoading(false);
                            return;
                        }
                    }
                } catch (err: any) {
                    console.error("Error checking conflict:", err);
                }
            }

            // If no conflict or conflict bypassed/resolved, proceed with normal booking
            await createNewBooking();
        } catch (err: any) {
            console.error("Error in handleConfirmBooking:", err);
            setErrorMessage(err.message || 'Erro ao confirmar agendamento.');
            setLoading(false);
        }
    };

    // Download Receipt PDF
    const handleDownloadPdf = async (booking?: ConsultaAgendamento) => {
        const targetBooking = booking || createdBooking;
        if (!targetBooking) return;
        setIsGenerating(true);
        setPrintingBooking(targetBooking);

        // Allow template portal to render
        await new Promise(resolve => setTimeout(resolve, 500));

        try {
            const container = document.getElementById('consulta-pdf-content');
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

            const protocol = targetBooking.id.substring(0, 8).toUpperCase();
            pdf.save(`Comprovante-Agendamento-${protocol}.pdf`);
        } catch (error) {
            console.error('Erro ao gerar PDF do agendamento:', error);
            alert('Não foi possível gerar o PDF no momento.');
        } finally {
            setIsGenerating(false);
            setPrintingBooking(null);
        }
    };

    // Filter procedures: pesquisa pelo valor digitado no início (startsWith), e não por "contém" (includes)
    const normalizeStr = (str: string) => 
        str ? str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim() : '';

    const cleanQuery = normalizeStr(procedureQuery);

    const filteredProcedures = procedures.filter(p => {
        if (!cleanQuery) return true;
        const normName = normalizeStr(p.name);
        const normCode = p.code ? normalizeStr(p.code) : '';
        return normName.startsWith(cleanQuery) || normCode.startsWith(cleanQuery);
    });

    // Helper functions and waitlist check defined at top

    const matchTime = (t1: string | undefined, t2: string) => {
        if (!t1 || !t2) return false;
        return t1.substring(0, 5) === t2.substring(0, 5);
    };

    const slotAssignments = React.useMemo(() => {
        const assignments = new Map<string, ConsultaAgendamento>();
        
        // Group slots by date
        const slotsByDate: { [date: string]: ConsultaVaga[] } = {};
        vagas.forEach(v => {
            if (!slotsByDate[v.data]) {
                slotsByDate[v.data] = [];
            }
            slotsByDate[v.data].push(v);
        });

        // Group bookings by date (excluding cancelados/não realizados)
        const bookingsByDate: { [date: string]: ConsultaAgendamento[] } = {};
        procedureBookings.forEach(b => {
            if (b.status === 'Cancelado' || b.status === 'Não Realizado' || !b.appointment_date) return;
            if (!bookingsByDate[b.appointment_date]) {
                bookingsByDate[b.appointment_date] = [];
            }
            bookingsByDate[b.appointment_date].push(b);
        });

        // Match for each date
        Object.keys(slotsByDate).forEach(dateStr => {
            const slots = slotsByDate[dateStr];
            const bookings = bookingsByDate[dateStr] || [];
            
            const unmatchedBookings = [...bookings];
            const matchedBookingIds = new Set<string>();

            // First pass: Match exact times
            slots.forEach(slot => {
                const exactMatch = bookings.find(b => 
                    b.appointment_time && 
                    matchTime(b.appointment_time, slot.hora) &&
                    !matchedBookingIds.has(b.id)
                );
                if (exactMatch) {
                    assignments.set(slot.id, exactMatch);
                    matchedBookingIds.add(exactMatch.id);
                    const idx = unmatchedBookings.findIndex(b => b.id === exactMatch.id);
                    if (idx > -1) {
                        unmatchedBookings.splice(idx, 1);
                    }
                }
            });

            // Second pass: Match remaining bookings to remaining unmatched slots
            slots.forEach(slot => {
                if (!assignments.has(slot.id) && unmatchedBookings.length > 0) {
                    const nextBooking = unmatchedBookings.shift()!;
                    assignments.set(slot.id, nextBooking);
                }
            });
        });

        return assignments;
    }, [vagas, procedureBookings]);

    const getSlotBooking = (slot: ConsultaVaga) => {
        return slotAssignments.get(slot.id);
    };

    const isSlotVisible = (slot: ConsultaVaga) => {
        const activeBooking = getSlotBooking(slot);
        const isConfirmed = activeBooking && ['Agendado', 'Retorno', 'Realizado'].includes(activeBooking.status);
        return !isConfirmed;
    };

    const isSlotReallyAvailable = (slot: ConsultaVaga) => {
        const activeBooking = getSlotBooking(slot);
        return !activeBooking;
    };

    // If booking was confirmed, show custom confirmation/receipt screen
    if (createdBooking) {
        return (
            <div className="w-full max-w-[96%] 2xl:max-w-[1440px] mx-auto flex flex-col h-full max-h-full min-h-0 bg-white/95 backdrop-blur-md rounded-[2.5rem] border border-slate-200/80 shadow-[0_20px_60px_rgba(0,0,0,0.06)] overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-8 text-center max-w-xl mx-auto space-y-5 w-full min-h-0 overflow-hidden">
                    {/* Success Icon with glowing background animation */}
                    <div className="relative flex items-center justify-center shrink-0">
                        <div className={`absolute inset-0 rounded-full blur-md opacity-45 animate-pulse ${
                            createdBooking.status === 'Fila de espera' ? 'bg-amber-500' : 'bg-emerald-500'
                        }`} />
                        <div className={`relative w-14 h-14 border-2 rounded-2xl flex items-center justify-center shadow-lg transition-transform duration-300 hover:scale-105 ${
                            createdBooking.status === 'Fila de espera'
                            ? 'bg-amber-50 border-amber-200 text-amber-500'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-500'
                        }`}>
                            <CheckCircle2 className="w-7 h-7" />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <h2 className="text-xl font-black text-slate-800 tracking-tight uppercase">
                            {createdBooking.status === 'Fila de espera' ? 'Fila de Espera Registrada!' : 'Solicitação Registrada!'}
                        </h2>
                        <p className="text-xs font-semibold text-slate-400 max-w-md mx-auto leading-relaxed">
                            {createdBooking.status === 'Fila de espera' 
                                ? 'O paciente foi adicionado à fila de espera do procedimento.' 
                                : 'A solicitação municipal de agendamento foi registrada com sucesso.'}
                        </p>
                    </div>

                    {/* Premium Digital Voucher (Ticket Style) */}
                    <div className="w-full bg-slate-50/70 border border-slate-200/50 rounded-[2rem] p-5 text-left shadow-sm relative overflow-hidden group hover:border-slate-300 transition-colors duration-300">
                        {/* Ticket punch hole style cutouts */}
                        <div className="absolute top-1/2 left-0 w-3.5 h-7 bg-white border-r border-slate-200/50 rounded-r-full -translate-y-1/2" />
                        <div className="absolute top-1/2 right-0 w-3.5 h-7 bg-white border-l border-slate-200/50 rounded-l-full -translate-y-1/2" />

                        {/* Ticket Header */}
                        <div className="flex items-center justify-between border-b border-dashed border-slate-200/80 pb-3.5 mb-3.5">
                            <div className="flex flex-col gap-0.5">
                                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Protocolo</span>
                                <span className="text-xs font-mono font-black text-slate-700">
                                    {createdBooking.id.substring(0, 8).toUpperCase()}
                                </span>
                            </div>
                            
                            <div className="flex gap-2">
                                <span className={`font-black uppercase text-[9px] tracking-wide px-2.5 py-0.5 rounded-full border ${
                                     createdBooking.priority === 'Urgência'
                                     ? 'bg-rose-50 border-rose-100 text-rose-600'
                                     : createdBooking.is_retorno
                                     ? 'bg-teal-50 border-teal-100 text-teal-600'
                                     : 'bg-slate-100 border-slate-200/60 text-slate-600'
                                 }`}>{createdBooking.priority === 'Urgência' ? 'Urgência' : createdBooking.is_retorno ? 'Retorno' : 'Normal'}</span>
                                 
                                <span className={`font-black uppercase text-[9px] tracking-wide px-2.5 py-0.5 rounded-full border ${
                                     createdBooking.status === 'Solicitado' || createdBooking.status === 'Agendado' 
                                     ? 'bg-emerald-50 border-emerald-100 text-emerald-600' 
                                     : createdBooking.status === 'Retorno'
                                     ? 'bg-teal-50 border-teal-100 text-teal-600'
                                     : createdBooking.status === 'Fila de espera'
                                     ? 'bg-amber-50 border-amber-100 text-amber-600'
                                     : 'bg-slate-100 border-slate-200/60 text-slate-600'
                                 }`}>{createdBooking.status}</span>
                            </div>
                        </div>

                        {/* Ticket Details Grid */}
                        <div className="grid grid-cols-2 gap-x-6 gap-y-3.5 text-xs font-bold text-slate-500">
                            <div className="space-y-0.5">
                                <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-extrabold">Paciente</span>
                                <span className="text-slate-800 uppercase font-black break-words block">{formatPatientName(createdBooking.paciente || selectedPatient)}</span>
                            </div>
                            
                            <div className="space-y-0.5">
                                <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-extrabold">Procedimento</span>
                                <span className="text-slate-800 uppercase font-black break-words block">{createdBooking.procedimento?.name || selectedProcedure?.name}</span>
                            </div>

                            <div className="space-y-0.5">
                                <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-extrabold">CPF do Paciente</span>
                                <span className="text-slate-700 block font-semibold">{(createdBooking.paciente?.cpf || selectedPatient!.cpf).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}</span>
                            </div>

                            <div className="space-y-0.5">
                                <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-extrabold">Data da Solicitação</span>
                                <span className="text-slate-800 font-bold block">
                                    {createdBooking.solicitation_date
                                        ? new Date(createdBooking.solicitation_date + 'T12:00:00').toLocaleDateString('pt-BR')
                                        : new Date(solicitationDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                                </span>
                            </div>

                            <div className="space-y-0.5 col-span-2">
                                <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-extrabold">Data e Hora</span>
                                <span className={`block font-extrabold ${createdBooking.status === 'Fila de espera' || !createdBooking.appointment_time ? 'text-amber-600 font-extrabold' : 'text-slate-800'}`}>
                                    {createdBooking.status !== 'Fila de espera' && createdBooking.appointment_time
                                        ? `${new Date(createdBooking.appointment_date + 'T12:00:00').toLocaleDateString('pt-BR')} às ${createdBooking.appointment_time.substring(0, 5)}`
                                        : 'Aguardando Vaga'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Integrated Action Buttons */}
                    <div className="w-full space-y-2.5 pt-2 shrink-0">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
                            <button
                                onClick={() => handleDownloadPdf()}
                                disabled={isGenerating}
                                className="w-full px-5 py-3.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white font-black rounded-xl shadow-lg shadow-sky-500/10 active:scale-95 hover:scale-[1.01] transition-all text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                            >
                                {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
                                {isGenerating ? 'Gerando PDF...' : 'Baixar Comprovante'}
                            </button>
                            
                            <button
                                onClick={() => {
                                    // Reset all state
                                    setStep(1);
                                    setPatientQuery('');
                                    setPatientResults([]);
                                    setSelectedPatient(null);
                                    setIsRegistering(false);
                                    setNewPatientName('');
                                    setNewPatientNickname('');
                                    setNewPatientCpf('');
                                    setNewPatientBirthDate('');
                                    setNewPatientPhone('');
                                    setNewPatientNeighborhood('');
                                    setNewPatientStreet('');
                                    setNewPatientCity('SÃO JOSÉ DO GOIABAL -MG');
                                    setNewPatientSusNumber('');
                                    setCpfError('');
                                    setSelectedProcedure(null);
                                    setBookingQty(1);
                                    setBookingPriority('Normal');
                                    setErrorMessage('');
                                    setSuccessMessage('');
                                    setCreatedBooking(null);
                                    setBookingTime('');
                                    setActiveDate('');
                                    const d = new Date();
                                    const y = d.getFullYear();
                                    const m = String(d.getMonth() + 1).padStart(2, '0');
                                    const day = String(d.getDate()).padStart(2, '0');
                                    setSolicitationDate(`${y}-${m}-${day}`);
                                }}
                                className="w-full px-5 py-3.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-800 font-black rounded-xl active:scale-95 hover:scale-[1.01] transition-all text-[10px] uppercase tracking-wider flex items-center justify-center cursor-pointer"
                            >
                                Novo Agendamento
                            </button>
                        </div>

                        <button
                            onClick={() => onNavigate('consultas:acompanhar')}
                            className="w-full py-2 bg-transparent text-sky-600 hover:text-sky-700 font-bold hover:underline transition-all text-[10px] uppercase tracking-widest flex items-center justify-center gap-1.5 cursor-pointer group/link"
                        >
                            Ir para a fila de acompanhamento 
                            <ChevronRight className="w-4 h-4 transition-transform duration-300 group-hover/link:translate-x-1" />
                        </button>
                    </div>
                </div>

                {/* PDF Portal Rendering */}
                {printingBooking && (
                    <ConsultaPdfGenerator
                        bookingId={printingBooking.id}
                        patient={printingBooking.paciente || selectedPatient!}
                        procedure={printingBooking.procedimento || selectedProcedure!}
                        date={printingBooking.appointment_date}
                        quantity={printingBooking.quantity}
                        priority={printingBooking.priority}
                        is_retorno={printingBooking.is_retorno}
                        currentUser={currentUser}
                        state={appState}
                    />
                )}
            </div>
        );
    }

    // Move hooks to top to avoid React Hook mismatch during early return



    return (
        <div className="w-full max-w-[98%] 2xl:max-w-[1440px] mx-auto flex flex-col h-full max-h-full min-h-0 bg-white/95 backdrop-blur-md rounded-[2rem] border border-slate-200/80 shadow-[0_20px_60px_rgba(0,0,0,0.06)] overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60 shrink-0">
                <div className="flex items-center gap-3">
                    <button 
                        onClick={onBack} 
                        className="p-2 text-slate-400 hover:text-slate-800 hover:bg-slate-200/70 rounded-xl transition-all active:scale-95"
                        title="Voltar"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                        <h3 className="font-black text-slate-900 tracking-tight text-lg uppercase">Novo Agendamento</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Módulo de Regulação e Consultas</p>
                    </div>
                </div>

                {/* Barra de Abas com Rotas URL Dedicadas */}
                <div className="flex items-center gap-1 sm:gap-1.5 bg-slate-100/90 p-1 rounded-xl border border-slate-200/80 shadow-inner">
                    {[
                        { stepNum: 1, label: 'Paciente', route: 'consultas:novo-agendamento-paciente', icon: UserIcon },
                        { stepNum: 2, label: 'Procedimento', route: 'consultas:novo-agendamento-procedimento', icon: CalendarDays },
                        { stepNum: 3, label: 'Revisão e Confirmação', route: 'consultas:novo-agendamento-revisao', icon: CheckCircle2 }
                    ].map((tab) => {
                        const Icon = tab.icon;
                        const isActive = step === tab.stepNum;
                        const isClickable = (() => {
                            if (tab.stepNum === 1) return true;
                            if (tab.stepNum === 2) return !!selectedPatient;
                            if (tab.stepNum === 3) return !!selectedPatient && !!selectedProcedure && (!!bookingDate || isWaitlistOnly);
                            return false;
                        })();
                        return (
                            <button
                                key={tab.stepNum}
                                type="button"
                                onClick={() => {
                                    if (isClickable) {
                                        onNavigate(tab.route);
                                    }
                                }}
                                disabled={!isClickable}
                                className={`px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-1.5 outline-none border-0 ${
                                    isActive
                                    ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20 scale-[1.02] cursor-default'
                                    : isClickable
                                    ? 'bg-white text-slate-700 hover:bg-sky-50 hover:text-sky-700 shadow-sm cursor-pointer'
                                    : 'bg-transparent text-slate-400 cursor-not-allowed opacity-50'
                                }`}
                            >
                                <div className={`w-5 h-5 rounded-md flex items-center justify-center ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                    <Icon className="w-3 h-3" />
                                </div>
                                <span className="hidden md:inline">{tab.label}</span>
                                <span className="md:hidden">Aba {tab.stepNum}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Content Body - Centralized layout, no scrollbars on the window */}
            <div className="flex-1 overflow-hidden flex flex-col p-2.5 md:p-3 min-h-0 bg-white">
                
                {errorMessage && (
                    <div className="mb-3 p-3 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl text-xs font-bold flex items-center gap-2.5 animate-in slide-in-from-top-4 duration-300 shrink-0 shadow-sm">
                        <div className="w-6 h-6 rounded-lg bg-rose-100 flex items-center justify-center shrink-0">
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        </div>
                        {errorMessage}
                    </div>
                )}

                {successMessage && (
                    <div className="mb-3 p-3 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-2xl text-xs font-bold flex items-center gap-2.5 animate-in slide-in-from-top-4 duration-300 shrink-0 shadow-sm">
                        <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                        </div>
                        {successMessage}
                    </div>
                )}

                {/* STEP 1: PACIENTE */}
                {step === 1 && (
                    <div className="flex-1 flex flex-col min-h-0 animate-in fade-in duration-300">
                        {selectedPatient && !isRegistering ? (
                            /* ABA 1: INFORMAÇÕES COMPLETAS DO PACIENTE SELECIONADO */
                            <div className="flex-1 flex flex-col min-h-0 space-y-2 justify-between">
                                <div className="flex items-center justify-between shrink-0 bg-gradient-to-r from-sky-50 to-indigo-50/50 border border-sky-100 p-2.5 rounded-xl shadow-sm">
                                    <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center font-black text-sm shadow-md shadow-sky-600/20">
                                            {selectedPatient.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">Paciente Vinculado</span>
                                            </div>
                                            <h3 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-tight mt-0.5">{formatPatientName(selectedPatient)}</h3>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setSelectedPatient(null);
                                            onNavigate('consultas:novo-agendamento');
                                        }}
                                        className="px-2.5 py-1 bg-white border border-slate-200 hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 text-slate-600 rounded-lg text-[11px] font-extrabold transition-all shadow-sm active:scale-95 flex items-center gap-1 cursor-pointer shrink-0"
                                    >
                                        <X className="w-3 h-3 text-rose-500" />
                                        Alterar Paciente
                                    </button>
                                </div>

                                {/* Cartão de Informações Pessoais do Paciente */}
                                <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-2.5 space-y-1.5 shadow-sm">
                                    <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-600 flex items-center gap-1.5 pb-1 border-b border-slate-200/80">
                                        <UserIcon className="w-3.5 h-3.5 text-sky-600" />
                                        Informações Completas do Paciente
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5 sm:gap-2 text-[11px]">
                                        <div>
                                            <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">Nome Completo</span>
                                            <span className="text-slate-900 font-extrabold uppercase truncate block">{selectedPatient.name}</span>
                                        </div>
                                        <div>
                                            <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">Apelido</span>
                                            <span className="text-slate-800 font-bold uppercase truncate block">{selectedPatient.nickname || 'Não informado'}</span>
                                        </div>
                                        <div>
                                            <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">CPF</span>
                                            <span className="text-slate-800 font-mono font-bold block">{selectedPatient.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}</span>
                                        </div>
                                        <div>
                                            <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">Data de Nascimento</span>
                                            <span className="text-slate-800 font-bold block">
                                                {new Date(selectedPatient.birth_date + 'T12:00:00').toLocaleDateString('pt-BR')} 
                                                {calculateAge(selectedPatient.birth_date) ? ` (${calculateAge(selectedPatient.birth_date)})` : ''}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">Telefone / WhatsApp</span>
                                            <span className="text-slate-800 font-bold block">{selectedPatient.phone || 'Não informado'}</span>
                                        </div>
                                        <div>
                                            <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">Cidade</span>
                                            <span className="text-slate-800 font-bold uppercase truncate block">{selectedPatient.city || 'SÃO JOSÉ DO GOIABAL - MG'}</span>
                                        </div>
                                        <div>
                                            <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">Bairro</span>
                                            <span className="text-slate-800 font-bold uppercase truncate block">{selectedPatient.neighborhood || 'Não informado'}</span>
                                        </div>
                                        <div>
                                            <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">Número do SUS</span>
                                            <span className="text-slate-800 font-bold block">{selectedPatient.sus_number || 'Não informado'}</span>
                                        </div>
                                        <div>
                                            <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">Agente de Saúde</span>
                                            <span className="text-slate-800 font-bold uppercase truncate block">{selectedPatient.agente_saude || 'Não informado'}</span>
                                        </div>
                                        <div className="sm:col-span-1">
                                            <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">Endereço (Rua / Número)</span>
                                            <span className="text-slate-800 font-bold uppercase truncate block">{selectedPatient.street || 'Não informado'}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Cartão de Histórico de Agendamentos do Paciente */}
                                <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-2.5 space-y-1.5 shadow-sm">
                                    <h4 className="text-[11px] font-black uppercase tracking-widest text-slate-600 flex items-center gap-1.5 pb-1 border-b border-slate-200/80">
                                        <Activity className="w-3.5 h-3.5 text-indigo-600" />
                                        Histórico Recente de Agendamentos do Paciente
                                    </h4>
                                    {patientHistory.length > 0 ? (
                                        <div className="space-y-1.5 max-h-24 overflow-y-auto scrollbar-none pr-1">
                                            {patientHistory.slice(0, 3).map(h => (
                                                <div key={h.id} className="p-2 bg-white rounded-lg border border-slate-200/70 flex items-center justify-between text-[11px] hover:border-slate-300 transition-colors shadow-sm">
                                                    <div>
                                                        <span className="font-extrabold text-slate-800 uppercase block leading-tight">{h.procedimento?.name || 'Procedimento'}</span>
                                                        <span className="text-[9px] text-slate-400 font-bold">
                                                            Data: {new Date(h.appointment_date + 'T12:00:00').toLocaleDateString('pt-BR')} • Prioridade: {h.priority}
                                                        </span>
                                                    </div>
                                                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase border ${
                                                        h.status === 'Agendado' || h.status === 'Solicitado'
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                                        : h.status === 'Fila de espera'
                                                        ? 'bg-amber-50 text-amber-700 border-amber-100'
                                                        : 'bg-slate-100 text-slate-600 border-slate-200'
                                                    }`}>
                                                        {h.status}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-[11px] text-slate-400 font-semibold py-1">Nenhum agendamento anterior registrado para este paciente em nossa base.</p>
                                    )}
                                </div>

                                <div className="pt-0.5 flex justify-end shrink-0">
                                    <button
                                        onClick={() => onNavigate('consultas:novo-agendamento-procedimento')}
                                        className="px-5 py-2 bg-sky-600 hover:bg-sky-700 text-white font-extrabold rounded-xl shadow-md shadow-sky-600/10 hover:shadow-sky-600/20 active:scale-95 transition-all text-xs uppercase tracking-widest flex items-center gap-1.5 cursor-pointer"
                                    >
                                        Avançar para Procedimento
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* BUSCAR OU CADASTRAR PACIENTE */
                            <div className="flex-1 flex flex-col min-h-0">
                                <div className="flex items-center justify-between mb-5 shrink-0">
                                    <div>
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Identificação</h4>
                                        <h3 className="text-base font-black text-slate-800 uppercase tracking-tight mt-0.5">Vincular Paciente</h3>
                                    </div>
                                    <button
                                        onClick={() => {
                                            setIsRegistering(!isRegistering);
                                            setSelectedPatient(null);
                                            setErrorMessage('');
                                        }}
                                        className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all duration-300 flex items-center gap-2 border shadow-sm active:scale-95 ${
                                            isRegistering 
                                            ? 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700' 
                                            : 'bg-sky-50 border-sky-100 hover:bg-sky-100/50 text-sky-700'
                                        }`}
                                    >
                                        <UserPlus className="w-4 h-4" />
                                        {isRegistering ? 'Buscar Existente' : 'Cadastrar Novo'}
                                    </button>
                                </div>

                                {!isRegistering ? (
                                    /* SEARCH PACIENTE */
                                    <div className="flex-1 flex flex-col min-h-0">
                                        <div className="relative mb-5 shrink-0">
                                            <input
                                                type="text"
                                                placeholder="Pesquise por Nome Completo, CPF ou Número do SUS..."
                                                className="w-full bg-slate-50/50 border border-slate-200/80 rounded-2xl pl-12 pr-4 py-4 text-sm font-medium focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-500/10 focus:border-sky-500 transition-all text-slate-900 placeholder:text-slate-400 shadow-inner"
                                                value={patientQuery}
                                                onChange={(e) => setPatientQuery(e.target.value)}
                                            />
                                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                                            {searching && (
                                                <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 text-sky-600 w-5 h-5 animate-spin" />
                                            )}
                                        </div>

                                        <div className="flex-1 overflow-y-auto border border-slate-100 rounded-2xl bg-slate-50/30 p-3 custom-scrollbar min-h-0">
                                            {patientResults.length > 0 ? (
                                                <div className="space-y-2.5">
                                                    {patientResults.map((patient) => (
                                                        <div 
                                                            key={patient.id}
                                                            onClick={() => {
                                                                setSelectedPatient(patient);
                                                                onNavigate('consultas:novo-agendamento-paciente');
                                                            }}
                                                            className={`p-4 rounded-xl border transition-all duration-300 cursor-pointer flex items-center justify-between group/card ${
                                                                selectedPatient?.id === patient.id
                                                                ? 'bg-gradient-to-r from-sky-50 to-white border-sky-400 ring-2 ring-sky-500/5 shadow-md translate-x-1'
                                                                : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5'
                                                            }`}
                                                        >
                                                            <div>
                                                                <div className="font-extrabold text-slate-800 text-sm group-hover/card:text-slate-900 transition-colors">{formatPatientName(patient)}</div>
                                                                <div className="flex items-center gap-4 text-xs text-slate-400 mt-1.5 font-bold uppercase tracking-wider">
                                                                    <span className="flex items-center gap-1"><UserIcon className="w-3.5 h-3.5 text-slate-300" /> CPF: {patient.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}</span>
                                                                    <span>Nasc: {new Date(patient.birth_date).toLocaleDateString('pt-BR')}</span>
                                                                </div>
                                                            </div>
                                                            <div className="w-7 h-7 rounded-xl bg-sky-600 text-white flex items-center justify-center animate-in zoom-in shadow-md shadow-sky-600/20">
                                                                <Check className="w-4.5 h-4.5" strokeWidth={3} />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8">
                                                    <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm mb-4">
                                                        <Users className="w-8 h-8 text-slate-300" />
                                                    </div>
                                                    {patientQuery.trim().length >= 3 ? (
                                                        <p className="text-sm font-semibold text-slate-500">Nenhum paciente cadastrado com estes dados.</p>
                                                    ) : (
                                                        <p className="text-xs font-semibold text-center text-slate-400 leading-relaxed uppercase tracking-wider">Digite ao menos 3 caracteres<br/>para buscar o paciente</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    /* REGISTER PACIENTE */
                                    <form onSubmit={handleRegisterPatient} className="flex-1 flex flex-col min-h-0 justify-between">
                                        <div className="space-y-5 overflow-y-auto flex-1 min-h-0 pr-1 custom-scrollbar">
                                            <div>
                                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 ml-1">Nome Completo</label>
                                                <input
                                                    type="text"
                                                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all text-xs font-semibold uppercase placeholder:text-slate-300 shadow-inner"
                                                    placeholder="Ex: Maria das Graças Silva"
                                                    value={newPatientName}
                                                    onChange={(e) => setNewPatientName(e.target.value.toUpperCase())}
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 ml-1">Apelido</label>
                                                <input
                                                    type="text"
                                                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all text-xs font-semibold uppercase placeholder:text-slate-300 shadow-inner"
                                                    placeholder="Ex: Netinho"
                                                    value={newPatientNickname}
                                                    onChange={(e) => setNewPatientNickname(e.target.value.toUpperCase())}
                                                />
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                                <div>
                                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 ml-1">CPF</label>
                                                    <input
                                                        type="text"
                                                        className={`w-full rounded-xl border bg-slate-50/50 p-3.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-4 outline-none transition-all text-xs font-bold tracking-wider shadow-inner ${
                                                            cpfError 
                                                            ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/10' 
                                                            : 'border-slate-200 focus:border-sky-500 focus:ring-sky-500/10'
                                                        }`}
                                                        placeholder="000.000.000-00"
                                                        value={newPatientCpf}
                                                        onChange={(e) => handleCpfChange(e.target.value)}
                                                        required
                                                    />
                                                    {cpfError && <span className="text-[9px] text-rose-500 font-extrabold ml-1 mt-1 block uppercase tracking-wider">{cpfError}</span>}
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 ml-1">Data de Nascimento</label>
                                                    <input
                                                        type="date"
                                                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all text-xs font-bold shadow-inner"
                                                        value={newPatientBirthDate}
                                                        onChange={(e) => setNewPatientBirthDate(e.target.value)}
                                                        required
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                                <div>
                                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 ml-1">Telefone</label>
                                                    <input
                                                        type="text"
                                                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all text-xs font-bold tracking-wider shadow-inner"
                                                        placeholder="(00) 00000-0000"
                                                        value={newPatientPhone}
                                                        onChange={(e) => handlePhoneChange(e.target.value)}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 ml-1">Bairro</label>
                                                    <input
                                                        type="text"
                                                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all text-xs font-semibold uppercase placeholder:text-slate-300 shadow-inner"
                                                        placeholder="Ex: Centro"
                                                        value={newPatientNeighborhood}
                                                        onChange={(e) => setNewPatientNeighborhood(e.target.value.toUpperCase())}
                                                    />
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-5">
                                                <div>
                                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 ml-1">Número do SUS (Opcional)</label>
                                                    <input
                                                        type="text"
                                                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all text-xs font-bold tracking-wider shadow-inner"
                                                        placeholder="000 0000 0000 0000"
                                                        value={newPatientSusNumber}
                                                        onChange={(e) => setNewPatientSusNumber(e.target.value.replace(/\D/g, '').slice(0, 15))}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 ml-1">Agente de Saúde (ACS)</label>
                                                    <div className="relative">
                                                        <select
                                                            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 pr-8 text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all text-xs font-semibold uppercase cursor-pointer appearance-none shadow-inner"
                                                            value={newPatientAgenteSaude}
                                                            onChange={(e) => setNewPatientAgenteSaude(e.target.value)}
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
                                                <div>
                                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 ml-1">Rua</label>
                                                    <input
                                                        type="text"
                                                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all text-xs font-semibold uppercase placeholder:text-slate-300 shadow-inner"
                                                        placeholder="Ex: Rua Principal, 10"
                                                        value={newPatientStreet}
                                                        onChange={(e) => setNewPatientStreet(e.target.value.toUpperCase())}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1.5 ml-1">Cidade</label>
                                                    <input
                                                        type="text"
                                                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all text-xs font-semibold uppercase placeholder:text-slate-300 shadow-inner"
                                                        placeholder="Ex: São José do Goiabal - MG"
                                                        value={newPatientCity}
                                                        onChange={(e) => setNewPatientCity(e.target.value.toUpperCase())}
                                                        required
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-5 flex justify-end shrink-0">
                                            <button
                                                type="submit"
                                                disabled={loading}
                                                className="px-8 py-3.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-extrabold rounded-2xl shadow-lg shadow-sky-600/10 hover:shadow-sky-600/20 active:scale-95 transition-all text-xs uppercase tracking-widest flex items-center gap-2 cursor-pointer"
                                            >
                                                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                                Salvar & Avançar
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* STEP 2: SELECIONAR EXAME E DATA */}
                {step === 2 && (
                    <div className="flex-1 flex flex-col min-h-0 animate-in fade-in duration-300">
                        {!selectedProcedure ? (
                            /* VISÃO 1: APENAS A LISTA DE EXAMES COM PESQUISA */
                            <div className="flex-1 flex flex-col min-h-0">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 shrink-0 gap-2">
                                    <div>
                                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Aba 2: Procedimento</h4>
                                        <h3 className="text-base font-black text-slate-800 uppercase tracking-tight mt-0.5">Selecione o Exame ou Consulta</h3>
                                    </div>
                                    <div className="px-3.5 py-2 bg-sky-50 border border-sky-100 rounded-xl flex items-center gap-2 shrink-0">
                                        <UserIcon className="w-4 h-4 text-sky-600" />
                                        <span className="text-[10px] text-sky-700 font-extrabold uppercase tracking-wide">Paciente: {formatPatientName(selectedPatient)}</span>
                                    </div>
                                </div>

                                {/* Campo de Pesquisa de Exames */}
                                <div className="relative mb-4 shrink-0">
                                    <input
                                        type="text"
                                        placeholder="Pesquisar exame ou consulta por nome ou código..."
                                        className="w-full bg-slate-50/70 border border-slate-200/80 rounded-2xl pl-12 pr-10 py-3.5 text-xs font-semibold focus:bg-white focus:outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 transition-all text-slate-900 shadow-inner"
                                        value={procedureQuery}
                                        onChange={(e) => setProcedureQuery(e.target.value)}
                                    />
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4.5 h-4.5" />
                                    {procedureQuery && (
                                        <button
                                            type="button"
                                            onClick={() => setProcedureQuery('')}
                                            className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full transition-all hover:bg-slate-100"
                                            title="Limpar pesquisa"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>

                                {/* Lista de Exames/Procedimentos filtrados apenas mediante pesquisa */}
                                <div className="flex-1 overflow-y-auto border border-slate-100 rounded-2xl bg-slate-50/20 p-3 custom-scrollbar min-h-0">
                                    {procedureQuery.trim() === '' ? (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center animate-fade-in">
                                            <div className="w-14 h-14 bg-sky-50 text-sky-600 rounded-2xl flex items-center justify-center mb-3 shadow-sm border border-sky-100/60">
                                                <Search className="w-7 h-7" />
                                            </div>
                                            <p className="text-xs font-black uppercase tracking-wider text-slate-700 mb-1">
                                                Pesquisar Procedimento
                                            </p>
                                            <p className="text-[11px] font-semibold text-slate-400 max-w-sm leading-relaxed">
                                                Digite o nome ou código do exame/consulta no campo acima para exibir os resultados correspondentes.
                                            </p>
                                        </div>
                                    ) : filteredProcedures.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 animate-fade-in">
                                            {filteredProcedures.map((proc) => {
                                                const hasSlots = proc.available_quantity > 0;
                                                const isCritical = proc.available_quantity > 0 && proc.available_quantity <= 5;
                                                return (
                                                    <div 
                                                        key={proc.id}
                                                        onClick={() => setSelectedProcedure(proc)}
                                                        className="p-3 rounded-xl border bg-white border-slate-200/80 hover:border-sky-400 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-center group cursor-pointer"
                                                    >
                                                        <div className="space-y-1.5">
                                                            <div className="font-extrabold text-slate-800 text-[11px] uppercase group-hover:text-sky-600 transition-colors leading-snug">
                                                                 {proc.name}
                                                            </div>
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <span className={`px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider rounded border ${
                                                                    proc.type === 'Exame'
                                                                    ? 'bg-sky-50 text-sky-600 border-sky-100'
                                                                    : proc.type === 'Consulta'
                                                                    ? 'bg-indigo-50 text-indigo-600 border-indigo-100'
                                                                    : 'bg-rose-50 text-rose-600 border-rose-100'
                                                                }`}>
                                                                    {proc.type}
                                                                </span>
                                                                {proc.code && (
                                                                    <span className="px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider rounded border bg-slate-50 border-slate-200 text-slate-500">
                                                                        CÓD. {proc.code}
                                                                    </span>
                                                                )}
                                                                {canSeeSlots && (
                                                                    <span className={`px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider rounded border ${
                                                                        !hasSlots 
                                                                        ? 'bg-rose-50 text-rose-600 border-rose-100' 
                                                                        : isCritical 
                                                                        ? 'bg-amber-50 text-amber-600 border-amber-100 animate-pulse' 
                                                                        : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                                                    }`}>
                                                                        {Math.max(0, proc.available_quantity)} vagas
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 text-center animate-fade-in">
                                            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mb-3">
                                                <Search className="w-6 h-6" />
                                            </div>
                                            <p className="text-xs font-black uppercase tracking-wider text-slate-600 mb-1">Nenhum exame ou consulta encontrado</p>
                                            <p className="text-[11px] font-semibold text-slate-400">Nenhum procedimento corresponde a "{procedureQuery}".</p>
                                        </div>
                                    )}
                                </div>

                                {/* Botão Voltar */}
                                <div className="mt-4 flex justify-between shrink-0">
                                    <button
                                        onClick={() => onNavigate('consultas:novo-agendamento-paciente')}
                                        className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-extrabold rounded-2xl active:scale-95 transition-all text-xs uppercase tracking-wider cursor-pointer"
                                    >
                                        Voltar para Paciente
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* VISÃO 2: TELA DO PROCEDIMENTO SELECIONADO */
                            <div className="flex-1 flex flex-col min-h-0 space-y-3 overflow-y-auto scrollbar-none pr-0.5">
                                {/* Cabeçalho da Tela do Procedimento */}
                                <div className="flex items-center justify-between shrink-0 bg-gradient-to-r from-sky-50 to-indigo-50/50 border border-sky-100 p-3 sm:p-3.5 rounded-2xl shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center font-black text-sm shadow-md shadow-sky-600/20">
                                            <CalendarDays className="w-4.5 h-4.5" />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 bg-sky-100 text-sky-700 rounded-full">Tela do Procedimento</span>
                                                <span className="text-[9px] font-bold text-slate-400 uppercase">CÓD. {selectedProcedure.code || 'N/A'}</span>
                                            </div>
                                            <h3 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight mt-0.5">{selectedProcedure.name}</h3>
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedProcedure(null)}
                                        className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-extrabold transition-all shadow-sm active:scale-95 flex items-center gap-1.5 cursor-pointer shrink-0"
                                    >
                                        <ArrowLeft className="w-3.5 h-3.5 text-slate-500" />
                                        Trocar Procedimento
                                    </button>
                                </div>

                                {/* Form Grid da Tela do Procedimento */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0">
                                    {/* Formulário de Agendamento */}
                                    <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between space-y-3 shadow-sm min-h-0">
                                        <div>
                                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-600 flex items-center gap-2 pb-2 border-b border-slate-200/80 mb-3">
                                                <Calendar className="w-4 h-4 text-sky-600" />
                                                Dados do Agendamento
                                            </h4>
                                            
                                            <div className="space-y-3">
                                                <div>
                                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 ml-1">Data da Solicitação</label>
                                                    <button
                                                        type="button"
                                                        onClick={() => setIsSolicitationCalendarOpen(true)}
                                                        className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-800 hover:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none shadow-sm transition-all flex items-center justify-between cursor-pointer group"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <Calendar className="w-4 h-4 text-sky-600 group-hover:scale-110 transition-transform" />
                                                            <span>
                                                                {solicitationDate
                                                                    ? new Date(solicitationDate + 'T12:00:00').toLocaleDateString('pt-BR')
                                                                    : 'Selecionar Data da Solicitação'}
                                                            </span>
                                                        </div>
                                                        <span className="text-[9px] font-black uppercase tracking-wider text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-100">
                                                            Alterar Data
                                                        </span>
                                                    </button>
                                                </div>

                                                <div>
                                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 ml-1">Prioridade do Agendamento</label>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {[
                                                            { value: 'Normal', label: 'Normal', color: 'border-slate-200 hover:border-slate-300 text-slate-600 bg-white' },
                                                            { value: 'Urgência', label: 'Urgência', color: 'border-rose-200 bg-rose-50/30 text-rose-700 hover:bg-rose-50' }
                                                        ].map((opt) => {
                                                            const isSel = bookingPriority === opt.value;
                                                            return (
                                                                <button
                                                                    key={opt.value}
                                                                    type="button"
                                                                    onClick={() => setBookingPriority(opt.value as 'Normal' | 'Urgência')}
                                                                    className={`py-2 px-3 rounded-xl border text-xs font-black uppercase tracking-wider transition-all duration-300 active:scale-95 text-center flex items-center justify-center gap-2 cursor-pointer ${
                                                                        isSel
                                                                        ? opt.value === 'Urgência'
                                                                            ? 'bg-rose-600 border-rose-600 text-white shadow-lg shadow-rose-600/20'
                                                                            : 'bg-sky-600 border-sky-600 text-white shadow-lg shadow-sky-600/20'
                                                                        : opt.color
                                                                    }`}
                                                                >
                                                                    {opt.value === 'Urgência' && (
                                                                        <div className={`w-2 h-2 rounded-full ${isSel ? 'bg-white' : 'bg-rose-600'} animate-ping`} />
                                                                    )}
                                                                    {opt.label}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                {canSeeSlots ? (
                                                    <div>
                                                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 ml-1">Data e Horário da Consulta / Exame</label>
                                                        <button
                                                            type="button"
                                                            disabled={isWaitlistOnly}
                                                            onClick={() => setIsCalendarOpen(true)}
                                                            className={`w-full rounded-xl border p-2.5 text-xs font-bold text-left flex items-center justify-between shadow-sm transition-all ${
                                                                isWaitlistOnly
                                                                ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                                                                : 'border-emerald-600 bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-500/10 focus:ring-emerald-500/20 focus:ring-4 outline-none cursor-pointer'
                                                            }`}
                                                        >
                                                            <span>
                                                                {isWaitlistOnly
                                                                    ? `Fila de espera (Não há vagas de ${bookingPriority.toLowerCase()} disponíveis)`
                                                                    : bookingDate 
                                                                        ? `${new Date(bookingDate + 'T12:00:00').toLocaleDateString('pt-BR')}${bookingTime ? ` às ${bookingTime}` : ''}`
                                                                        : 'Clique para Selecionar a Data e Horário no Calendário'}
                                                            </span>
                                                            <Calendar className={`w-4 h-4 ${isWaitlistOnly ? 'text-slate-400' : 'text-white'}`} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-[11px] font-bold text-amber-800 flex items-center gap-2">
                                                        <Info className="w-4 h-4 text-amber-600 shrink-0" />
                                                        <span>A solicitação será direcionada automaticamente para a Fila de Espera.</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Resumo do Voucher */}
                                    <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between space-y-3 shadow-sm min-h-0">
                                        <div>
                                            <h4 className="text-xs font-black uppercase tracking-widest text-slate-600 flex items-center gap-2 pb-2 border-b border-slate-200/80 mb-2.5">
                                                <Ticket className="w-4 h-4 text-indigo-600" />
                                                Resumo do Voucher
                                            </h4>

                                            <div className="relative p-3.5 bg-gradient-to-b from-white to-slate-50/50 border border-slate-200/60 rounded-xl space-y-2 shadow-md shadow-slate-100/40 overflow-hidden">
                                                {/* Círculos recortados do ticket */}
                                                <div className="absolute top-1/2 -left-2.5 w-4 h-4 bg-slate-100 border-r border-slate-200/60 rounded-full -translate-y-1/2"></div>
                                                <div className="absolute top-1/2 -right-2.5 w-4 h-4 bg-slate-100 border-l border-slate-200/60 rounded-full -translate-y-1/2"></div>

                                                <div className="space-y-2 text-xs">
                                                    <div className="flex justify-between items-start gap-3">
                                                        <span className="font-bold text-slate-400 shrink-0">Paciente:</span>
                                                        <span className="font-black text-slate-800 uppercase text-right break-words">{formatPatientName(selectedPatient)}</span>
                                                    </div>
                                                    <div className="flex justify-between items-start gap-3">
                                                        <span className="font-bold text-slate-400 shrink-0">Procedimento:</span>
                                                        <span className="font-black text-slate-800 uppercase text-right break-words">{selectedProcedure.name}</span>
                                                    </div>
                                                    <div className="flex justify-between items-start gap-3">
                                                        <span className="font-bold text-slate-400 shrink-0">Data da Solicitação:</span>
                                                        <span className="font-black text-slate-800 text-right">
                                                            {solicitationDate ? new Date(solicitationDate + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between items-start gap-3">
                                                        <span className="font-bold text-slate-400 shrink-0">Data e Hora Escolhida:</span>
                                                        <span className="font-black text-slate-800 text-right break-words">
                                                            {!canSeeSlots || isWaitlistOnly
                                                                ? 'Fila de Espera (Automático)'
                                                                : bookingDate 
                                                                    ? `${new Date(bookingDate + 'T12:00:00').toLocaleDateString('pt-BR')}${bookingTime ? ` às ${bookingTime}` : ''}`
                                                                    : 'Aguardando seleção...'}
                                                        </span>
                                                    </div>
                                                    {canSeeSlots && (
                                                        <div className="flex justify-between items-center gap-3">
                                                            <span className="font-bold text-slate-400 shrink-0">Vagas Disponíveis:</span>
                                                            <span className={`font-black ${
                                                                (!isWaitlistOnly && getAvailableSlots(selectedProcedure, bookingPriority, bookingDate) > 0) 
                                                                ? 'text-emerald-600' 
                                                                : 'text-rose-600'
                                                            }`}>
                                                                {isWaitlistOnly ? 0 : getAvailableSlots(selectedProcedure, bookingPriority, bookingDate)} vagas
                                                            </span>
                                                        </div>
                                                    )}
                                                    <div className="flex justify-between items-center gap-3">
                                                        <span className="font-bold text-slate-400 shrink-0">Prioridade:</span>
                                                        <span className={`font-black uppercase text-[10px] px-2 py-0.5 rounded ${
                                                            bookingPriority === 'Urgência' ? 'bg-rose-500 text-white shadow-sm' : 'bg-slate-100 text-slate-700'
                                                        }`}>{bookingPriority}</span>
                                                    </div>
                                                    {canSeeSlots && (isWaitlistOnly || getAvailableSlots(selectedProcedure, bookingPriority, bookingDate) <= 0) ? (
                                                        <div className="text-[9.5px] font-bold text-amber-600 bg-amber-50 border border-amber-100 p-2 rounded-xl mt-1.5 flex items-center gap-2 shadow-sm">
                                                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                                                            <span>Sem vagas de {bookingPriority.toLowerCase()} disponíveis. Paciente irá para a fila de espera.</span>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex justify-between pt-2 border-t border-slate-200/80 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => setSelectedProcedure(null)}
                                                className="px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-extrabold rounded-xl active:scale-95 transition-all text-xs uppercase tracking-wider cursor-pointer"
                                            >
                                                Escolher Outro Exame
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => onNavigate('consultas:novo-agendamento-revisao')}
                                                disabled={canSeeSlots && !bookingDate && !isWaitlistOnly}
                                                className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white font-extrabold rounded-xl shadow-lg shadow-sky-600/10 hover:shadow-sky-600/20 active:scale-95 transition-all text-xs uppercase tracking-widest flex items-center gap-2 cursor-pointer"
                                            >
                                                Avançar para Revisão
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* STEP 3: REVISÃO E CONFIRMAÇÃO */}
                {step === 3 && (
                    <div className="flex-1 flex flex-col min-h-0 justify-between animate-in fade-in duration-300">
                        <div className="space-y-6 flex-1 overflow-y-auto pr-1 scrollbar-hide min-h-0 pb-4">
                            <div>
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Revisão</h4>
                                <h3 className="text-base font-black text-slate-800 uppercase tracking-tight mt-0.5">Revisar Dados do Agendamento</h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Paciente Card */}
                                <div className="p-6 bg-gradient-to-br from-white to-slate-50/50 border border-slate-200/60 rounded-3xl space-y-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-sky-500/5 rounded-bl-[100%]"></div>
                                    <h5 className="text-[10px] font-black uppercase tracking-widest text-sky-600 flex items-center gap-2">
                                        <UserIcon className="w-4 h-4 text-sky-500" />
                                        Identificação do Paciente
                                    </h5>
                                    <div className="space-y-3 pt-2">
                                        <div>
                                            <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">Nome Completo</span>
                                            <span className="text-sm font-black text-slate-800 uppercase">{formatPatientName(selectedPatient)}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">CPF</span>
                                                <span className="text-xs font-bold text-slate-700">
                                                    {selectedPatient?.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">Data de Nascimento</span>
                                                <span className="text-xs font-bold text-slate-700">
                                                    {selectedPatient && new Date(selectedPatient.birth_date + 'T12:00:00').toLocaleDateString('pt-BR')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Procedimento Card */}
                                <div className="p-6 bg-gradient-to-br from-white to-slate-50/50 border border-slate-200/60 rounded-3xl space-y-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-bl-[100%]"></div>
                                    <h5 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2">
                                        <CalendarDays className="w-4 h-4 text-indigo-500" />
                                        Detalhes do Agendamento
                                    </h5>
                                    <div className="space-y-3 pt-2">
                                        <div>
                                            <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">Procedimento Escolhido</span>
                                            <span className="text-sm font-black text-slate-800 block uppercase break-words leading-tight">{selectedProcedure?.name}</span>
                                        </div>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                                            <div>
                                                <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">Data do Atendimento</span>
                                                <span className="text-xs font-bold text-slate-700">
                                                    {!canSeeSlots || isWaitlistOnly
                                                        ? 'Fila de Espera (Registro Automático)'
                                                        : (bookingDate && new Date(bookingDate + 'T12:00:00').toLocaleDateString('pt-BR')) + (bookingTime ? ` às ${bookingTime}` : '')}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">Prioridade</span>
                                                <span className={`inline-block text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded mt-0.5 ${
                                                    bookingPriority === 'Urgência'
                                                    ? 'bg-rose-500 text-white shadow-sm animate-pulse'
                                                    : 'bg-slate-100 text-slate-700'
                                                }`}>
                                                    {bookingPriority}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">Status Estimado</span>
                                                {!canSeeSlots || isWaitlistOnly ? (
                                                    <span className="inline-block text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded mt-0.5 bg-amber-50 text-amber-700 border border-amber-100 font-extrabold animate-pulse">
                                                        Fila de Espera
                                                    </span>
                                                ) : selectedProcedure && canSeeSlots && getAvailableSlots(selectedProcedure, bookingPriority, bookingDate) > 0 ? (
                                                    <span className="inline-block text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded mt-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 font-extrabold">
                                                        Agendado
                                                    </span>
                                                ) : (
                                                    <span className="inline-block text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded mt-0.5 bg-amber-50 text-amber-700 border border-amber-100 font-extrabold animate-pulse">
                                                        Fila de Espera
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Metadata / Auditoria */}
                            <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-2xl flex flex-col md:flex-row md:items-center justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest gap-2 shadow-inner">
                                <div>Operador Responsável: <span className="text-slate-700 font-extrabold">{currentUser.name} ({currentUser.username})</span></div>
                                <div>Registro do Sistema: <span className="text-slate-700 font-extrabold">{new Date().toLocaleString('pt-BR')}</span></div>
                            </div>
                        </div>

                        <div className="mt-6 flex justify-between shrink-0">
                            <button
                                onClick={() => onNavigate('consultas:novo-agendamento-procedimento')}
                                className="px-5 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-extrabold rounded-2xl active:scale-95 transition-all text-xs uppercase tracking-wider cursor-pointer"
                            >
                                Voltar para Procedimento
                            </button>
                            <button
                                onClick={handleConfirmBooking}
                                disabled={loading}
                                className="px-8 py-3.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 disabled:opacity-50 text-white font-extrabold rounded-2xl shadow-xl shadow-sky-500/20 active:scale-95 transition-all text-xs uppercase tracking-widest flex items-center gap-2"
                            >
                                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                Confirmar Agendamento
                            </button>
                        </div>
                    </div>
                )}

            </div>
            {/* MODAL: CPF NÃO CADASTRADO */}
            {showCpfNotFoundModal && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2rem] shadow-[0_30px_100px_rgba(0,0,0,0.2)] w-full max-w-md overflow-hidden border border-slate-100 flex flex-col transform transition-all animate-in zoom-in-[0.98] slide-in-from-bottom-10 duration-500">
                        
                        <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-sky-500 to-cyan-500 p-8 pb-10 flex flex-col items-center justify-center text-white shrink-0">
                            {/* Decorative background elements */}
                            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/2"></div>
                            <div className="absolute bottom-0 left-0 w-24 h-24 bg-sky-300/30 rounded-full blur-xl translate-y-1/2 -translate-x-1/2"></div>
                            
                            <button 
                                onClick={() => setShowCpfNotFoundModal(false)} 
                                className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all hover:rotate-90 duration-300"
                            >
                                <X className="w-4 h-4" />
                            </button>
                            
                            <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-4 shadow-xl ring-1 ring-white/30 animate-in zoom-in duration-500 delay-150">
                                <UserPlus className="w-8 h-8 text-white drop-shadow-md" />
                            </div>
                            
                            <h3 className="text-xl font-black text-white text-center leading-tight drop-shadow-sm">
                                Paciente não<br/>encontrado
                            </h3>
                            <p className="text-sky-100 text-xs font-bold uppercase tracking-widest mt-3 opacity-90">
                                Identificação do Sistema
                            </p>
                        </div>
                        
                        <div className="p-8 pb-6 flex flex-col items-center space-y-6 relative -mt-4 bg-white rounded-t-[2rem]">
                            <p className="text-sm text-slate-500 font-semibold text-center leading-relaxed max-w-[280px]">
                                Este CPF ainda não possui registro em nossa base. Gostaria de iniciar o cadastro agora?
                            </p>
                            
                            <div className="w-full relative group">
                                <div className="absolute inset-0 bg-gradient-to-r from-sky-500 to-indigo-500 rounded-2xl blur-md opacity-20 group-hover:opacity-30 transition-opacity duration-500"></div>
                                <div className="relative px-5 py-4 bg-white border border-sky-100 rounded-2xl flex justify-between items-center shadow-sm">
                                    <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">CPF Informado</span>
                                    <span className="text-base text-slate-800 font-black font-mono">
                                        {unregisteredCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4") || unregisteredCpf}
                                    </span>
                                </div>
                            </div>
                        </div>
                        
                        <div className="p-6 pt-2 bg-white flex justify-center gap-4 shrink-0 w-full">
                            <button
                                type="button"
                                onClick={() => setShowCpfNotFoundModal(false)}
                                className="flex-1 py-3.5 bg-slate-50 hover:bg-slate-100 text-slate-500 font-extrabold rounded-2xl text-xs uppercase tracking-wider active:scale-95 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowCpfNotFoundModal(false);
                                    handleCpfChange(unregisteredCpf);
                                    setIsRegistering(true);
                                }}
                                className="flex-1 py-3.5 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white font-extrabold rounded-2xl text-xs uppercase tracking-wider active:scale-[0.98] transition-all shadow-xl shadow-sky-500/30 flex items-center justify-center gap-2"
                            >
                                Cadastrar
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
            {/* MODAL: CONFLITO DE DATA (MAIS PRÓXIMA) */}
            {isConflictModalOpen && conflictBooking && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-[0_25px_70px_rgba(0,0,0,0.15)] w-full max-w-md overflow-hidden border border-slate-100 flex flex-col transform transition-all animate-in zoom-in-95 slide-in-from-bottom-8 duration-300">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                            <div>
                                <h3 className="text-sm font-black text-amber-600 uppercase tracking-wider flex items-center gap-1.5">
                                    <AlertTriangle className="w-4 h-4" /> Alterar Data do Agendamento
                                </h3>
                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Procedimento já agendado anteriormente</p>
                            </div>
                            <button 
                                onClick={() => {
                                    setIsConflictModalOpen(false);
                                    setConflictBooking(null);
                                }} 
                                className="p-2 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-700 transition-all hover:rotate-90 duration-300"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <p className="text-xs text-slate-600 font-semibold leading-relaxed">
                                O paciente já possui um agendamento ativo para **{selectedProcedure?.name}**. 
                                Como a nova data proposta é mais próxima, você pode optar por transferir o agendamento existente para a nova data.
                            </p>
                            
                            <div className="p-4 bg-slate-50 border border-slate-200/50 rounded-2xl space-y-2.5 text-xs font-bold text-slate-700 shadow-inner">
                                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                                    <span className="text-slate-400 font-semibold">Data Atual:</span>
                                    <span className="text-slate-800 line-through">
                                        {new Date(conflictBooking.appointment_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sky-600 font-black">Nova Data Mais Próxima:</span>
                                    <span className="text-sky-600 font-black bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-lg">
                                        {new Date(bookingDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                                    </span>
                                </div>
                            </div>
                            
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                * Nota: Não é permitido ter 2 agendamentos ativos para o mesmo procedimento. O agendamento antigo será atualizado para a nova data.
                            </p>
                        </div>
                        <div className="p-5 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsConflictModalOpen(false);
                                    setConflictBooking(null);
                                }}
                                className="px-5 py-3 bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 font-extrabold rounded-2xl text-xs uppercase tracking-wider active:scale-95 transition-all"
                            >
                                Manter Anterior
                            </button>
                            <button
                                type="button"
                                onClick={handleRescheduleConflict}
                                disabled={loading}
                                className="px-6 py-3 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 disabled:opacity-50 text-white font-extrabold rounded-2xl text-xs uppercase tracking-wider active:scale-95 transition-all flex items-center gap-1.5 shadow-md shadow-sky-500/20"
                            >
                                {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                Alterar Data
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
            {/* MODAL: SELECIONAR DATA DA CONSULTA (CALENDÁRIO DE VAGAS) */}
            {isCalendarOpen && selectedProcedure && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-[0_25px_70px_rgba(0,0,0,0.15)] w-full max-w-2xl md:max-w-3xl overflow-hidden border border-slate-100 flex flex-col h-[600px] max-h-[90vh] animate-in zoom-in-95 slide-in-from-bottom-8 duration-300">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
                            <div>
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Selecione Data e Hora</h3>
                                <p className="text-[10px] text-sky-600 font-black uppercase tracking-wider mt-0.5">{selectedProcedure.name}</p>
                            </div>
                            <button 
                                onClick={() => setIsCalendarOpen(false)} 
                                className="p-2 hover:bg-slate-200 rounded-xl text-slate-400 hover:text-slate-700 transition-all hover:rotate-90 duration-300"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        {/* Body */}
                        <div className="flex-1 min-h-0 flex overflow-hidden">
                            {loadingVagas ? (
                                <div className="flex-1 flex flex-col items-center justify-center space-y-3">
                                    <Loader2 className="w-8 h-8 text-sky-600 animate-spin" />
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Carregando datas...</span>
                                </div>
                            ) : (vagas.length === 0 || vagas.filter(isSlotVisible).length === 0) ? (
                                <div className="flex-1 p-6 flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in duration-300">
                                    <AlertTriangle className="w-12 h-12 text-amber-500 animate-bounce" />
                                    <div className="space-y-1">
                                        <h4 className="text-sm font-black text-slate-800 uppercase">Sem vagas cadastradas</h4>
                                        <p className="text-[10px] text-slate-400 font-semibold max-w-xs leading-relaxed">
                                            Não há datas com horários definidos para este procedimento. O agendamento será direcionado automaticamente para a Fila de Espera.
                                        </p>
                                    </div>
                                    <div className="w-full max-w-sm pt-4">
                                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5 text-left ml-1">Escolha uma data para fila de espera</label>
                                        <input
                                            type="date"
                                            min={new Date().toISOString().split('T')[0]}
                                            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-slate-900 text-xs font-bold focus:bg-white focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all"
                                            value={bookingDate}
                                            onChange={(e) => {
                                                setBookingDate(e.target.value);
                                                setBookingTime('');
                                                setIsCalendarOpen(false);
                                            }}
                                            required
                                        />
                                    </div>
                                </div>
                            ) : (() => {
                                const todayStr = new Date().toISOString().split('T')[0];
                                const uniqueDates = Array.from(new Set(vagas.map(v => v.data)))
                                    .filter(d => d >= todayStr)
                                    .filter(d => vagas.filter(v => v.data === d).some(isSlotVisible))
                                    .sort();
                                const currentActiveDate = activeDate || (uniqueDates.length > 0 ? uniqueDates[0] : '');
                                const slotsForActiveDate = vagas.filter(v => v.data === currentActiveDate);

                                return (
                                    <>
                                        {/* Left Panel: Dates */}
                                        <div className="w-[42%] flex flex-col min-h-0 border-r border-slate-100 bg-slate-50/30">
                                            <div className="p-3 bg-slate-50/80 border-b border-slate-100 shrink-0 text-center flex items-center justify-center gap-1.5">
                                                <CalendarDays className="w-3.5 h-3.5 text-slate-400" />
                                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Datas Disponíveis</span>
                                            </div>
                                            <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5 custom-scrollbar">
                                                {uniqueDates.map(d => {
                                                    const isSelected = currentActiveDate === d;
                                                    const dateObj = new Date(d + 'T12:00:00');
                                                    const weekday = dateObj.toLocaleDateString('pt-BR', { weekday: 'long' }).split('-')[0];
                                                    const dateFormatted = dateObj.toLocaleDateString('pt-BR');
                                                    
                                                    const slotsForThisDate = vagas.filter(v => v.data === d);
                                                    const availableCount = slotsForThisDate.filter(v => 
                                                        v.status === 'Disponível' && 
                                                        isSlotReallyAvailable(v) && 
                                                        getAvailableSlots(selectedProcedure, bookingPriority, v.data) > 0
                                                    ).length;

                                                    return (
                                                        <button
                                                            key={d}
                                                            type="button"
                                                            onClick={() => setActiveDate(d)}
                                                            className={`w-full p-4 rounded-2xl border transition-all text-left flex items-center justify-between group/date ${
                                                                isSelected 
                                                                ? 'bg-gradient-to-r from-sky-50 to-white border-sky-300 border-l-4 border-l-sky-500 text-sky-800 shadow-md font-black scale-[1.01]' 
                                                                : 'bg-white border-slate-100 border-l-4 border-l-transparent hover:bg-slate-50 hover:border-slate-200 text-slate-600 hover:text-slate-800'
                                                            }`}
                                                        >
                                                            <div className="min-w-0 pr-2">
                                                                <span className={`text-[8px] font-black uppercase tracking-wider block ${
                                                                    isSelected ? 'text-sky-500' : 'text-slate-400 group-hover/date:text-slate-500'
                                                                }`}>
                                                                    {weekday}
                                                                </span>
                                                                <span className="text-xs font-black tracking-tight mt-0.5 block">
                                                                    {dateFormatted}
                                                                </span>
                                                            </div>
                                                            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded ${
                                                                availableCount > 0
                                                                ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20'
                                                                : 'bg-amber-500/10 text-amber-700 border border-amber-500/20 animate-pulse font-extrabold'
                                                            }`}>
                                                                {availableCount > 0 ? `${availableCount} v` : 'Fila'}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>

                                        {/* Right Panel: Times */}
                                        <div className="w-[58%] flex flex-col min-h-0">
                                            <div className="p-3 bg-slate-50/80 border-b border-slate-100 shrink-0 text-center flex items-center justify-center gap-1.5">
                                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                                    {currentActiveDate 
                                                        ? `Horários para ${new Date(currentActiveDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}`
                                                        : 'Horários de Atendimento'
                                                    }
                                                </span>
                                            </div>
                                            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
                                                {currentActiveDate ? (
                                                    slotsForActiveDate.length > 0 ? (
                                                        <div className="grid grid-cols-2 gap-3">
                                                            {slotsForActiveDate.map(slot => {
                                                                if (!isSlotVisible(slot)) return null;

                                                                const isReallyAvailable = slot.status === 'Disponível' && 
                                                                    isSlotReallyAvailable(slot) &&
                                                                    getAvailableSlots(selectedProcedure, bookingPriority, slot.data) > 0;
                                                                const slotTime = slot.hora.substring(0, 5);
                                                                
                                                                const activeBooking = getSlotBooking(slot);

                                                                // If there is a confirmed/realized booking, hide/remove the slot completely
                                                                if (activeBooking && ['Agendado', 'Retorno', 'Realizado'].includes(activeBooking.status)) {
                                                                    return null;
                                                                }

                                                                // If there is a pending request, block the slot (disable it)
                                                                const isBlocked = activeBooking && ['Solicitado', 'Fila de espera', 'Aguardando Data'].includes(activeBooking.status);

                                                                if (isBlocked) {
                                                                    return (
                                                                        <button
                                                                            key={slot.id}
                                                                            type="button"
                                                                            disabled={true}
                                                                            className="p-3.5 rounded-2xl border border-slate-200 bg-slate-100/70 text-slate-400 text-center font-black flex flex-col items-center justify-center space-y-1 cursor-not-allowed opacity-60 shadow-none"
                                                                        >
                                                                            <span className="text-sm tracking-wide line-through">{slotTime}</span>
                                                                            <span className="text-[8px] font-extrabold uppercase tracking-wider text-slate-400">
                                                                                Bloqueado
                                                                            </span>
                                                                        </button>
                                                                    );
                                                                }

                                                                return (
                                                                    <button
                                                                        key={slot.id}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setBookingDate(currentActiveDate);
                                                                            setBookingTime(slotTime);
                                                                            setIsCalendarOpen(false);
                                                                        }}
                                                                        className={`p-3.5 rounded-2xl border text-center font-black transition-all flex flex-col items-center justify-center space-y-1 hover:scale-[1.02] hover:-translate-y-0.5 active:scale-95 shadow-sm duration-200 ${
                                                                            isReallyAvailable
                                                                            ? 'bg-emerald-50/50 hover:bg-emerald-500 border-emerald-100 hover:border-emerald-500 text-emerald-800 hover:text-white shadow-emerald-500/5 hover:shadow-md'
                                                                            : 'bg-amber-50/50 hover:bg-amber-500 border-amber-100 hover:border-amber-500 text-amber-800 hover:text-white shadow-amber-500/5 hover:shadow-md'
                                                                        }`}
                                                                    >
                                                                        <span className="text-sm tracking-wide">{slotTime}</span>
                                                                        <span className="text-[8px] font-extrabold uppercase tracking-wider opacity-85">
                                                                            {isReallyAvailable ? 'Disponível' : 'Fila de Espera'}
                                                                        </span>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    ) : (
                                                        <div className="h-full flex items-center justify-center text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                                                            Nenhum horário cadastrado.
                                                        </div>
                                                    )
                                                ) : (
                                                    <div className="h-full flex items-center justify-center text-slate-400 text-[10px] font-bold uppercase tracking-wider text-center p-4">
                                                        Selecione uma data para ver os horários.
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                );
                            })()}
                        </div>
                        
                        {/* Footer / Legend */}
                        <div className="p-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[8px] font-black uppercase tracking-widest text-slate-400 shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded bg-emerald-500 shadow-sm shadow-emerald-500/20"></div>
                                    <span>Disponível</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded bg-amber-500 shadow-sm shadow-amber-500/20 animate-pulse"></div>
                                    <span>Fila de Espera</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded bg-slate-300 shadow-sm"></div>
                                    <span>Bloqueado (Pendente)</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                <span className="font-extrabold text-slate-400">Total de Horários: {vagas.length}</span>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
            {/* MODAL: CALENDÁRIO MODERNO DA DATA DA SOLICITAÇÃO */}
            {isSolicitationCalendarOpen && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-[0_25px_70px_rgba(0,0,0,0.2)] w-full max-w-md overflow-hidden border border-slate-100 flex flex-col transform transition-all animate-in zoom-in-95 duration-300">
                        
                        {/* Header com Gradiente Moderno */}
                        <div className="bg-gradient-to-r from-sky-600 via-indigo-600 to-sky-700 p-5 sm:p-6 text-white flex justify-between items-center relative overflow-hidden shrink-0">
                            <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-white/10 rounded-full blur-xl pointer-events-none"></div>
                            <div className="relative z-10">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-white/20 text-white backdrop-blur-md flex items-center gap-1">
                                        <Sparkles className="w-3 h-3" /> Regulação & Consultas
                                    </span>
                                </div>
                                <h3 className="text-lg font-black text-white uppercase tracking-tight">Data da Solicitação</h3>
                                <p className="text-[11px] text-sky-100 font-bold opacity-90">Selecione o dia da solicitação médica</p>
                            </div>
                            <button 
                                type="button"
                                onClick={() => setIsSolicitationCalendarOpen(false)} 
                                className="relative z-10 p-2 bg-white/10 hover:bg-white/20 rounded-xl text-white transition-all hover:rotate-90 duration-300 backdrop-blur-md cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Conteúdo do Calendário */}
                        <div className="p-5 sm:p-6 space-y-4 flex-1 min-h-0 bg-white">
                            
                            {/* Seletor de Mês */}
                            <div className="flex items-center justify-between bg-slate-50 border border-slate-200/80 p-2 rounded-2xl">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const prev = new Date(solicitationCalendarMonth);
                                        prev.setMonth(prev.getMonth() - 1);
                                        setSolicitationCalendarMonth(prev);
                                    }}
                                    className="p-2 hover:bg-white hover:shadow-sm rounded-xl text-slate-600 transition-all active:scale-95 cursor-pointer"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                
                                <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                                    {solicitationCalendarMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                                </span>

                                <button
                                    type="button"
                                    onClick={() => {
                                        const next = new Date(solicitationCalendarMonth);
                                        next.setMonth(next.getMonth() + 1);
                                        setSolicitationCalendarMonth(next);
                                    }}
                                    className="p-2 hover:bg-white hover:shadow-sm rounded-xl text-slate-600 transition-all active:scale-95 cursor-pointer"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Botões de Atalho Rápido */}
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const today = formatDateToYYYYMMDD(new Date());
                                        setSolicitationDate(today);
                                        setSolicitationCalendarMonth(new Date());
                                    }}
                                    className={`flex-1 py-2 px-3 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                        solicitationDate === formatDateToYYYYMMDD(new Date())
                                        ? 'bg-sky-600 text-white border-sky-600 shadow-md shadow-sky-600/20'
                                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                    }`}
                                >
                                    Hoje ({new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })})
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        const yest = new Date();
                                        yest.setDate(yest.getDate() - 1);
                                        setSolicitationDate(formatDateToYYYYMMDD(yest));
                                        setSolicitationCalendarMonth(yest);
                                    }}
                                    className={`flex-1 py-2 px-3 rounded-xl border text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                        solicitationDate === formatDateToYYYYMMDD(new Date(Date.now() - 86400000))
                                        ? 'bg-sky-600 text-white border-sky-600 shadow-md shadow-sky-600/20'
                                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                    }`}
                                >
                                    Ontem
                                </button>
                            </div>

                            {/* Dias da Semana */}
                            <div className="grid grid-cols-7 text-center gap-1">
                                {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map((day) => (
                                    <span key={day} className="text-[9px] font-black text-slate-400 uppercase tracking-widest py-1">
                                        {day}
                                    </span>
                                ))}
                            </div>

                            {/* Grid de Dias do Mês */}
                            <div className="grid grid-cols-7 gap-1">
                                {getDaysInMonth(solicitationCalendarMonth).map((dateObj, idx) => {
                                    if (!dateObj) return <div key={`empty-${idx}`} className="h-9" />;

                                    const dateStr = formatDateToYYYYMMDD(dateObj);
                                    const isSelected = solicitationDate === dateStr;
                                    const isToday = dateStr === formatDateToYYYYMMDD(new Date());

                                    return (
                                        <button
                                            key={dateStr}
                                            type="button"
                                            onClick={() => {
                                                setSolicitationDate(dateStr);
                                            }}
                                            className={`h-9 rounded-xl font-bold text-xs flex flex-col items-center justify-center transition-all cursor-pointer active:scale-95 ${
                                                isSelected
                                                ? 'bg-gradient-to-br from-sky-500 to-indigo-600 text-white font-black shadow-md shadow-sky-500/30 scale-[1.05]'
                                                : isToday
                                                ? 'bg-sky-50 text-sky-700 border border-sky-200 font-extrabold'
                                                : 'hover:bg-slate-100 text-slate-700'
                                            }`}
                                        >
                                            <span>{dateObj.getDate()}</span>
                                            {isToday && !isSelected && (
                                                <span className="w-1 h-1 bg-sky-500 rounded-full mt-0.5" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
                            <div className="text-[11px] font-bold text-slate-500">
                                Data Selecionada: <span className="font-black text-slate-800">{solicitationDate ? new Date(solicitationDate + 'T12:00:00').toLocaleDateString('pt-BR') : 'Nenhuma'}</span>
                            </div>

                            <button
                                type="button"
                                onClick={() => setIsSolicitationCalendarOpen(false)}
                                className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 text-white font-extrabold rounded-xl shadow-lg shadow-sky-600/20 active:scale-95 transition-all text-xs uppercase tracking-widest cursor-pointer"
                            >
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
            {/* MODAL: SUCESSO DE AGENDAMENTO */}
            {createdBooking && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] shadow-[0_25px_70px_rgba(0,0,0,0.2)] w-full max-w-md overflow-hidden border border-slate-100 flex flex-col transform transition-all animate-in zoom-in-95 duration-300 text-center p-6 space-y-4">
                        
                        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600 shadow-lg shadow-emerald-500/20">
                            <CheckCircle2 className="w-10 h-10" />
                        </div>

                        <div>
                            <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100">
                                {createdBooking.status === 'Fila de espera' ? 'Fila de Espera' : 'Agendamento Confirmado'}
                            </span>
                            <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight mt-2">
                                {createdBooking.status === 'Fila de espera'
                                    ? 'Paciente Registrado na Fila de Espera!'
                                    : 'Agendamento Realizado com Sucesso!'}
                            </h3>
                            <p className="text-xs text-slate-500 font-semibold mt-1">
                                {createdBooking.status === 'Fila de espera'
                                    ? 'O paciente ingressou na fila de espera e será notificado assim que surgirem novas vagas.'
                                    : `Agendado para ${new Date(createdBooking.appointment_date + 'T12:00:00').toLocaleDateString('pt-BR')} ${createdBooking.appointment_time ? 'às ' + createdBooking.appointment_time.substring(0, 5) : ''}`}
                            </p>
                        </div>

                        <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-left space-y-2 text-xs font-bold text-slate-700">
                            <div className="flex justify-between">
                                <span className="text-slate-400">Paciente:</span>
                                <span className="text-slate-900 font-extrabold uppercase">{createdBooking.paciente?.name || selectedPatient?.name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Procedimento:</span>
                                <span className="text-sky-600 font-black uppercase">{createdBooking.procedimento?.name || selectedProcedure?.name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Data da Solicitação:</span>
                                <span className="text-slate-800 font-bold">
                                    {createdBooking.solicitation_date
                                        ? new Date(createdBooking.solicitation_date + 'T12:00:00').toLocaleDateString('pt-BR')
                                        : new Date(solicitationDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Data e Hora:</span>
                                <span className={`font-black ${createdBooking.status === 'Fila de espera' || !createdBooking.appointment_time ? 'text-amber-600' : 'text-slate-800'}`}>
                                    {createdBooking.status !== 'Fila de espera' && createdBooking.appointment_time
                                        ? `${new Date(createdBooking.appointment_date + 'T12:00:00').toLocaleDateString('pt-BR')} às ${createdBooking.appointment_time.substring(0, 5)}`
                                        : 'Aguardando Vaga'}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-slate-400">Prioridade:</span>
                                <span className="text-slate-800 uppercase font-extrabold">{createdBooking.priority}</span>
                            </div>
                        </div>

                        <div className="pt-2 space-y-2.5">
                            <button
                                type="button"
                                onClick={() => handleDownloadPdf(createdBooking)}
                                disabled={isGenerating}
                                className="w-full py-3.5 bg-sky-600 hover:bg-sky-700 text-white font-extrabold rounded-2xl shadow-lg shadow-sky-600/20 active:scale-95 transition-all text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer"
                            >
                                {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                                Baixar Recibo (PDF)
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    setCreatedBooking(null);
                                    onNavigate('consultas');
                                }}
                                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 font-extrabold rounded-2xl active:scale-95 transition-all text-xs uppercase tracking-wider cursor-pointer"
                            >
                                Concluir e Voltar
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
            {/* MODAL: CADASTRO RÁPIDO DE PACIENTE NÃO ENCONTRADO (ESTILO FARMÁCIA POPULAR) */}
            {showCpfNotFoundModal && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200">
                    <div className="bg-white rounded-[2.5rem] shadow-[0_25px_70px_rgba(0,0,0,0.2)] w-full max-w-2xl overflow-hidden border border-slate-100 flex flex-col transform transition-all animate-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-6 bg-gradient-to-r from-sky-600 to-indigo-600 text-white flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
                                    <UserPlus className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="font-black text-base uppercase tracking-tight">Cadastrar Novo Paciente</h3>
                                    <p className="text-xs text-sky-100 font-semibold">
                                        CPF <span className="font-mono font-bold underline">{unregisteredCpf || newPatientCpf}</span> não encontrado no sistema
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowCpfNotFoundModal(false);
                                    setErrorMessage('');
                                }}
                                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Form Body */}
                        <form onSubmit={handleRegisterPatient} className="p-6 space-y-4 text-left overflow-y-auto max-h-[80vh]">
                            {errorMessage && (
                                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-bold flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 shrink-0" />
                                    <span>{errorMessage}</span>
                                </div>
                            )}

                            {/* CPF + Nome Completo */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="md:col-span-1">
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 ml-1">CPF do Paciente</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-xl border border-slate-200 bg-slate-100 py-3 px-3.5 text-xs text-slate-600 font-mono font-bold outline-none cursor-not-allowed shadow-inner"
                                        value={newPatientCpf}
                                        disabled
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 ml-1">Nome Completo *</label>
                                    <input
                                        type="text"
                                        autoFocus
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3 px-3.5 text-xs text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all font-semibold uppercase shadow-inner"
                                        placeholder="Nome Completo do Paciente"
                                        value={newPatientName}
                                        onChange={(e) => setNewPatientName(e.target.value.toUpperCase())}
                                        required
                                    />
                                </div>
                            </div>

                            {/* Apelido + Nasc + Telefone */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 ml-1">Apelido</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3 px-3.5 text-xs text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all font-semibold uppercase shadow-inner"
                                        placeholder="Ex: Netinho"
                                        value={newPatientNickname}
                                        onChange={(e) => setNewPatientNickname(e.target.value.toUpperCase())}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 ml-1">Data de Nascimento *</label>
                                    <input
                                        type="date"
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3 px-3.5 text-xs text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all font-bold shadow-inner cursor-pointer"
                                        value={newPatientBirthDate}
                                        onChange={(e) => setNewPatientBirthDate(e.target.value)}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 ml-1">Telefone</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3 px-3.5 text-xs text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all font-bold tracking-wider shadow-inner"
                                        placeholder="(00) 00000-0000"
                                        value={newPatientPhone}
                                        onChange={(e) => handlePhoneChange(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Número do SUS + Rua */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 ml-1">Número do SUS (Opcional)</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3 px-3.5 text-xs text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all font-bold tracking-wider shadow-inner"
                                        placeholder="000 0000 0000 0000"
                                        value={newPatientSusNumber}
                                        onChange={(e) => setNewPatientSusNumber(e.target.value.replace(/\D/g, '').slice(0, 15))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 ml-1">Rua</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3 px-3.5 text-xs text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all font-semibold uppercase shadow-inner"
                                        placeholder="Ex: Rua Principal, 10"
                                        value={newPatientStreet}
                                        onChange={(e) => setNewPatientStreet(e.target.value.toUpperCase())}
                                    />
                                </div>
                            </div>

                            {/* Bairro + Cidade */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 ml-1">Bairro</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3 px-3.5 text-xs text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all font-semibold uppercase shadow-inner"
                                        placeholder="Ex: Centro"
                                        value={newPatientNeighborhood}
                                        onChange={(e) => setNewPatientNeighborhood(e.target.value.toUpperCase())}
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 ml-1">Cidade *</label>
                                    <input
                                        type="text"
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3 px-3.5 text-xs text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all font-semibold uppercase shadow-inner"
                                        placeholder="Ex: São José do Goiabal - MG"
                                        value={newPatientCity}
                                        onChange={(e) => setNewPatientCity(e.target.value.toUpperCase())}
                                        required
                                    />
                                </div>
                            </div>

                            {/* Agente de Saúde */}
                            <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1 ml-1">Agente de Saúde (ACS)</label>
                                <div className="relative">
                                    <select
                                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3 px-3.5 pr-8 text-xs text-slate-900 focus:bg-white focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 outline-none transition-all font-semibold uppercase shadow-inner cursor-pointer appearance-none"
                                        value={newPatientAgenteSaude}
                                        onChange={(e) => setNewPatientAgenteSaude(e.target.value)}
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

                            {/* Buttons */}
                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCpfNotFoundModal(false);
                                        setErrorMessage('');
                                    }}
                                    className="px-5 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs hover:bg-slate-50 transition-all uppercase tracking-wider cursor-pointer"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-6 py-3 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white font-extrabold rounded-xl shadow-lg shadow-sky-600/20 active:scale-95 transition-all text-xs uppercase tracking-widest flex items-center gap-2 cursor-pointer disabled:opacity-50"
                                >
                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                    Salvar & Selecionar Paciente
                                </button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};
