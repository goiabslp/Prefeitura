import React, { useState, useEffect } from 'react';
import { User, ConsultaPaciente, ConsultaProcedimento, AppState, ConsultaAgendamento } from '../../types';
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
    Users,
    FileDown
} from 'lucide-react';
import * as db from '../../services/consultasService';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { ConsultaPdfGenerator } from './ConsultaPdfGenerator';

interface NovoAgendamentoScreenProps {
    currentUser: User;
    onBack: () => void;
    onNavigate: (view: string) => void;
    appState: AppState;
}

export const NovoAgendamentoScreen: React.FC<NovoAgendamentoScreenProps> = ({
    currentUser,
    onBack,
    onNavigate,
    appState
}) => {
    // Step state
    const [step, setStep] = useState<1 | 2 | 3>(1);
    
    // Loading states
    const [loading, setLoading] = useState(false);
    const [searching, setSearching] = useState(false);
    
    // Step 1: Patient States
    const [patientQuery, setPatientQuery] = useState('');
    const [patientResults, setPatientResults] = useState<ConsultaPaciente[]>([]);
    const [selectedPatient, setSelectedPatient] = useState<ConsultaPaciente | null>(null);
    const [isRegistering, setIsRegistering] = useState(false);
    
    // Register Patient Form
    const [newPatientName, setNewPatientName] = useState('');
    const [newPatientNickname, setNewPatientNickname] = useState('');
    const [newPatientCpf, setNewPatientCpf] = useState('');
    const [newPatientBirthDate, setNewPatientBirthDate] = useState('');
    const [newPatientPhone, setNewPatientPhone] = useState('');
    const [newPatientNeighborhood, setNewPatientNeighborhood] = useState('');
    const [newPatientStreet, setNewPatientStreet] = useState('');
    const [newPatientCity, setNewPatientCity] = useState('SÃO JOSÉ DO GOIABAL -MG');
    const [cpfError, setCpfError] = useState('');

    // Step 2: Booking Details States
    const [procedures, setProcedures] = useState<ConsultaProcedimento[]>([]);
    const [selectedProcedure, setSelectedProcedure] = useState<ConsultaProcedimento | null>(null);
    const [bookingDate, setBookingDate] = useState('');
    const [bookingQty, setBookingQty] = useState(1);
    const [bookingPriority, setBookingPriority] = useState<'Normal' | 'Urgência'>('Normal');
    const [procedureQuery, setProcedureQuery] = useState('');

    // Submission States
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [createdBooking, setCreatedBooking] = useState<ConsultaAgendamento | null>(null);
    const [isGenerating, setIsGenerating] = useState(false);

    // Load active procedures on mount
    useEffect(() => {
        const fetchProcedures = async () => {
            const data = await db.getProcedimentos(true); // only active
            setProcedures(data);
        };
        fetchProcedures();
        
        // Default booking date to tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        setBookingDate(tomorrow.toISOString().split('T')[0]);
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
                
                // Filter by name or CPF
                const results = allPatients.filter(p => 
                    p.name.toLowerCase().includes(query) || 
                    p.cpf.includes(query.replace(/\D/g, ''))
                );
                
                setPatientResults(results);
                setSearching(false);
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
                nickname: newPatientNickname.trim() || undefined,
                cpf: newPatientCpf,
                birth_date: newPatientBirthDate,
                phone: newPatientPhone.trim() || undefined,
                neighborhood: newPatientNeighborhood.trim() || undefined,
                street: newPatientStreet.trim() || undefined,
                city: newPatientCity.trim() || undefined
            });

            if (newPatient) {
                setSelectedPatient(newPatient);
                setIsRegistering(false);
                setStep(2);
            }
        } catch (err: any) {
            setErrorMessage(err.message || 'Erro ao cadastrar paciente.');
        } finally {
            setLoading(false);
        }
    };

    // Handle Schedule Submission
    const handleConfirmBooking = async () => {
        if (!selectedPatient || !selectedProcedure || !bookingDate) return;
        
        setErrorMessage('');
        setLoading(true);

        const optimisticBooking = {
            patient_id: selectedPatient.id,
            procedimento_id: selectedProcedure.id,
            appointment_date: bookingDate,
            quantity: bookingQty,
            priority: bookingPriority,
            status: 'Agendado' as const,
            created_by: currentUser.id
        };

        try {
            const result = await db.createAgendamento(optimisticBooking);
            setCreatedBooking(result);
            setSuccessMessage('Agendamento realizado com sucesso!');
        } catch (err: any) {
            setErrorMessage(err.message || 'Erro ao realizar agendamento.');
        } finally {
            setLoading(false);
        }
    };

    // Download Receipt PDF
    const handleDownloadPdf = async () => {
        if (!createdBooking) return;
        setIsGenerating(true);

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

            const protocol = createdBooking.id.substring(0, 8).toUpperCase();
            pdf.save(`Comprovante-Agendamento-${protocol}.pdf`);
        } catch (error) {
            console.error('Erro ao gerar PDF do agendamento:', error);
            alert('Não foi possível gerar o PDF no momento.');
        } finally {
            setIsGenerating(false);
        }
    };

    // Filter procedures
    const filteredProcedures = procedures.filter(p => 
        p.name.toLowerCase().includes(procedureQuery.toLowerCase())
    );

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
        if (priority === 'Urgência' || isLastWeekOfMonth(dateStr)) {
            return proc.available_quantity;
        }
        const total = proc.total_quantity || proc.available_quantity;
        const reserved = Math.ceil(total * 0.20);
        return Math.max(0, proc.available_quantity - reserved);
    };

    // If booking was confirmed, show custom confirmation/receipt screen
    if (createdBooking) {
        return (
            <div className="w-full max-w-[96%] 2xl:max-w-[1440px] mx-auto flex flex-col h-full max-h-full min-h-0 bg-white/95 backdrop-blur-md rounded-[2.5rem] border border-slate-200/80 shadow-[0_20px_60px_rgba(0,0,0,0.06)] overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                <div className="flex-1 flex flex-col items-center p-6 sm:p-8 text-center max-w-2xl mx-auto space-y-6 overflow-y-auto scrollbar-hide min-h-0 justify-start md:justify-center w-full">
                    {/* Success Icon */}
                    <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-[2rem] flex items-center justify-center shadow-lg shadow-emerald-500/10 animate-bounce">
                        <CheckCircle2 className="w-10 h-10" />
                    </div>

                    <div className="space-y-2">
                        <h2 className="text-2xl font-black text-slate-800 tracking-tight uppercase">Agendamento Confirmado!</h2>
                        <p className="text-sm font-semibold text-slate-500">O agendamento municipal foi registrado no sistema com sucesso.</p>
                    </div>

                    {/* Receipt Summary */}
                    <div className="w-full p-6 bg-slate-50 border border-slate-200/60 rounded-3xl space-y-4 text-left shadow-inner">
                        <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Protocolo do Agendamento</span>
                            <span className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-xs font-mono font-black text-slate-700">
                                {createdBooking.id.substring(0, 8).toUpperCase()}
                            </span>
                        </div>

                        <div className="space-y-3.5 text-xs font-bold text-slate-600">
                            <div className="flex justify-between items-start">
                                <span className="text-slate-400">Paciente:</span>
                                <span className="text-slate-800 text-right uppercase font-black">{createdBooking.paciente?.name || selectedPatient?.name}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400">CPF:</span>
                                <span className="text-slate-800">{(createdBooking.paciente?.cpf || selectedPatient!.cpf).replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}</span>
                            </div>
                            <div className="flex justify-between items-start">
                                <span className="text-slate-400">Procedimento:</span>
                                <span className="text-slate-800 text-right uppercase font-black">{createdBooking.procedimento?.name || selectedProcedure?.name}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400">Data Agendada:</span>
                                <span className="text-slate-800">{new Date(createdBooking.appointment_date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-slate-400">Prioridade:</span>
                                <span className={`font-black uppercase text-[10px] px-2.5 py-0.5 rounded ${
                                    createdBooking.priority === 'Urgência' ? 'bg-rose-500 text-white shadow-sm' : 'bg-slate-100 text-slate-700'
                                }`}>{createdBooking.priority}</span>
                            </div>
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 shrink-0">
                        <button
                            onClick={handleDownloadPdf}
                            disabled={isGenerating}
                            className="w-full px-6 py-4 bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 text-white font-black rounded-2xl shadow-xl shadow-sky-500/20 active:scale-95 transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                        >
                            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
                            {isGenerating ? 'Gerando PDF...' : 'Baixar Comprovante PDF'}
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
                                setCpfError('');
                                setSelectedProcedure(null);
                                setBookingQty(1);
                                setBookingPriority('Normal');
                                setErrorMessage('');
                                setSuccessMessage('');
                                setCreatedBooking(null);
                            }}
                            className="w-full px-6 py-4 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-black rounded-2xl active:scale-95 transition-all text-xs uppercase tracking-widest flex items-center justify-center"
                        >
                            Novo Agendamento
                        </button>
                        <button
                            onClick={() => onNavigate('consultas:acompanhar')}
                            className="w-full sm:col-span-2 px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold rounded-2xl active:scale-95 transition-all text-xs uppercase tracking-widest flex items-center justify-center gap-2 border border-slate-200"
                        >
                            Ir para Fila de Acompanhamento
                        </button>
                    </div>
                </div>

                {/* PDF Portal Rendering */}
                <ConsultaPdfGenerator
                    bookingId={createdBooking.id}
                    patient={createdBooking.paciente || selectedPatient!}
                    procedure={createdBooking.procedimento || selectedProcedure!}
                    date={createdBooking.appointment_date}
                    quantity={createdBooking.quantity}
                    priority={createdBooking.priority}
                    currentUser={currentUser}
                    state={appState}
                />
            </div>
        );
    }

    return (
        <div className="w-full max-w-[96%] 2xl:max-w-[1440px] mx-auto flex flex-col h-full max-h-full min-h-0 bg-white/95 backdrop-blur-md rounded-[2.5rem] border border-slate-200/80 shadow-[0_20px_60px_rgba(0,0,0,0.06)] overflow-hidden animate-in fade-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60 shrink-0">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={onBack} 
                        className="p-2.5 text-slate-400 hover:text-slate-800 hover:bg-slate-200/70 rounded-2xl transition-all active:scale-95"
                        title="Voltar"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h3 className="font-black text-slate-900 tracking-tight text-xl uppercase">Novo Agendamento</h3>
                        <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Módulo de Regulação e Consultas</p>
                    </div>
                </div>

                {/* Custom Stepper Timeline */}
                <div className="hidden sm:flex items-center gap-5 bg-white border border-slate-200/70 rounded-2xl p-1.5 px-4 shadow-sm">
                    {[
                        { stepNum: 1, label: 'Paciente', icon: UserIcon },
                        { stepNum: 2, label: 'Agendamento', icon: CalendarDays },
                        { stepNum: 3, label: 'Confirmação', icon: CheckCircle2 }
                    ].map((s) => {
                        const Icon = s.icon;
                        const isActive = step === s.stepNum;
                        const isCompleted = step > s.stepNum;
                        return (
                            <React.Fragment key={s.stepNum}>
                                <div className="flex items-center gap-2">
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300 ${
                                        isCompleted 
                                        ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' 
                                        : isActive 
                                        ? 'bg-sky-600 text-white shadow-lg shadow-sky-600/20 scale-105' 
                                        : 'bg-slate-100 text-slate-400 border border-slate-200/50'
                                    }`}>
                                        {isCompleted ? <Check className="w-4.5 h-4.5" strokeWidth={3} /> : <Icon className="w-4 h-4" />}
                                    </div>
                                    <span className={`text-[9px] uppercase tracking-wider font-extrabold transition-colors duration-300 ${
                                        isActive ? 'text-sky-600 font-black' : isCompleted ? 'text-emerald-600' : 'text-slate-400'
                                    }`}>
                                        {s.label}
                                    </span>
                                </div>
                                {s.stepNum < 3 && (
                                    <div className={`h-[2px] w-6 rounded-full transition-all duration-300 ${
                                        isCompleted ? 'bg-emerald-400' : 'bg-slate-200'
                                    }`} />
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>

                {/* Mobile Stepper Dot Indicator */}
                <div className="flex sm:hidden items-center gap-1.5 bg-white p-2 rounded-xl border border-slate-100 shadow-sm">
                    {[1, 2, 3].map((s) => (
                        <div 
                            key={s}
                            className={`h-2 rounded-full transition-all duration-300 ${
                                step === s 
                                ? 'w-6 bg-sky-600' 
                                : step > s 
                                ? 'w-2 bg-emerald-500' 
                                : 'w-2 bg-slate-200'
                            }`}
                        />
                    ))}
                </div>
            </div>

            {/* Content Body - Centralized layout, no scrollbars on the window */}
            <div className="flex-1 overflow-hidden flex flex-col p-4 md:p-5 min-h-0 bg-white">
                
                {errorMessage && (
                    <div className="mb-5 p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-2xl text-xs font-bold flex items-center gap-3 animate-in slide-in-from-top-4 duration-300 shrink-0 shadow-sm">
                        <div className="w-7 h-7 rounded-lg bg-rose-100 flex items-center justify-center shrink-0">
                            <AlertTriangle className="w-4 h-4 text-rose-600" />
                        </div>
                        {errorMessage}
                    </div>
                )}

                {successMessage && (
                    <div className="mb-5 p-4 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-2xl text-xs font-bold flex items-center gap-3 animate-in slide-in-from-top-4 duration-300 shrink-0 shadow-sm">
                        <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                            <Check className="w-4 h-4 text-emerald-600" />
                        </div>
                        {successMessage}
                    </div>
                )}

                {/* STEP 1: PACIENTE */}
                {step === 1 && (
                    <div className="flex-1 flex flex-col min-h-0 animate-in fade-in duration-300">
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
                                        placeholder="Pesquise por Nome Completo ou CPF..."
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
                                                    onClick={() => setSelectedPatient(patient)}
                                                    className={`p-4 rounded-xl border transition-all duration-300 cursor-pointer flex items-center justify-between group/card ${
                                                        selectedPatient?.id === patient.id
                                                        ? 'bg-gradient-to-r from-sky-50 to-white border-sky-400 ring-2 ring-sky-500/5 shadow-md translate-x-1'
                                                        : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5'
                                                    }`}
                                                >
                                                    <div>
                                                        <div className="font-extrabold text-slate-800 text-sm group-hover/card:text-slate-900 transition-colors">{patient.name}</div>
                                                        <div className="flex items-center gap-4 text-xs text-slate-400 mt-1.5 font-bold uppercase tracking-wider">
                                                            <span className="flex items-center gap-1"><UserIcon className="w-3.5 h-3.5 text-slate-300" /> CPF: {patient.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}</span>
                                                            <span>Nasc: {new Date(patient.birth_date).toLocaleDateString('pt-BR')}</span>
                                                        </div>
                                                    </div>
                                                    {selectedPatient?.id === patient.id && (
                                                        <div className="w-7 h-7 rounded-xl bg-sky-600 text-white flex items-center justify-center animate-in zoom-in shadow-md shadow-sky-600/20">
                                                            <Check className="w-4.5 h-4.5" strokeWidth={3} />
                                                        </div>
                                                    )}
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

                                <div className="mt-5 flex justify-end shrink-0">
                                    <button
                                        onClick={() => setStep(2)}
                                        disabled={!selectedPatient}
                                        className="px-8 py-3.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-40 disabled:hover:bg-sky-600 text-white font-extrabold rounded-2xl shadow-lg shadow-sky-600/10 hover:shadow-sky-600/20 active:scale-95 disabled:active:scale-100 transition-all text-xs uppercase tracking-widest"
                                    >
                                        Avançar
                                    </button>
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
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
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
                                        className="px-8 py-3.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-extrabold rounded-2xl shadow-lg shadow-sky-600/10 hover:shadow-sky-600/20 active:scale-95 transition-all text-xs uppercase tracking-widest flex items-center gap-2"
                                    >
                                        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                                        Salvar & Avançar
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                )}

                {/* STEP 2: SELECIONAR EXAME E DATA */}
                {step === 2 && (
                    <div className="flex-1 flex flex-col min-h-0 animate-in fade-in duration-300">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3 shrink-0 gap-2">
                            <div>
                                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Seleção</h4>
                                <h3 className="text-base font-black text-slate-800 uppercase tracking-tight mt-0.5">Detalhes do Agendamento</h3>
                            </div>
                            <div className="px-4 py-2 bg-sky-50 border border-sky-100 rounded-xl flex items-center gap-2">
                                <UserIcon className="w-4 h-4 text-sky-600" />
                                <span className="text-[10px] text-sky-700 font-extrabold uppercase tracking-wide">Paciente: {selectedPatient?.name}</span>
                            </div>
                        </div>

                        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 min-h-0">
                            {/* Left Col: Search & Procedure list */}
                            <div className="flex flex-col min-h-0">
                                <div className="relative mb-3.5 shrink-0">
                                    <input
                                        type="text"
                                        placeholder="Buscar exame ou consulta..."
                                        className="w-full bg-slate-50 border border-slate-200/80 rounded-xl pl-10 pr-4 py-3 text-xs font-semibold focus:bg-white focus:outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-500/5 transition-all text-slate-900"
                                        value={procedureQuery}
                                        onChange={(e) => setProcedureQuery(e.target.value)}
                                    />
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                                </div>

                                <div className="flex-1 overflow-y-auto border border-slate-100 rounded-2xl bg-slate-50/20 p-2.5 custom-scrollbar min-h-0 space-y-2">
                                    {filteredProcedures.length > 0 ? (
                                        filteredProcedures.map((proc) => {
                                            const hasSlots = proc.available_quantity > 0;
                                            const isCritical = proc.available_quantity <= 5;
                                            const isSelected = selectedProcedure?.id === proc.id;
                                            
                                            return (
                                                <div 
                                                    key={proc.id}
                                                    onClick={() => hasSlots && setSelectedProcedure(proc)}
                                                    className={`p-3.5 rounded-xl border transition-all duration-300 flex items-center justify-between group/proc ${
                                                        !hasSlots 
                                                        ? 'bg-slate-100/50 border-slate-200/60 opacity-55 cursor-not-allowed'
                                                        : isSelected
                                                        ? 'bg-gradient-to-r from-sky-50 to-white border-sky-400 ring-2 ring-sky-500/5 shadow-md'
                                                        : 'bg-white border-slate-100 hover:border-slate-300 hover:shadow-sm cursor-pointer hover:-translate-y-0.5'
                                                    }`}
                                                >
                                                    <div className="min-w-0 pr-2">
                                                        <div className="font-extrabold text-slate-800 text-xs truncate uppercase group-hover/proc:text-slate-950">{proc.name}</div>
                                                        <span className={`inline-block px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider rounded border mt-1.5 ${
                                                            proc.type === 'Exame'
                                                            ? 'bg-sky-50 text-sky-600 border-sky-100'
                                                            : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                                                        }`}>
                                                            {proc.type}
                                                        </span>
                                                    </div>
                                                    <div className="shrink-0 text-right">
                                                        <span className={`inline-block px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border shadow-sm ${
                                                            !hasSlots 
                                                            ? 'bg-rose-50 text-rose-600 border-rose-100 shadow-rose-100/30' 
                                                            : isCritical 
                                                            ? 'bg-amber-50 text-amber-600 border-amber-100 shadow-amber-100/30 animate-pulse' 
                                                            : 'bg-emerald-50 text-emerald-600 border-emerald-100 shadow-emerald-100/30'
                                                        }`}>
                                                            {proc.available_quantity} vagas
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8">
                                            <Calendar className="w-8 h-8 mb-2 opacity-25" />
                                            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Nenhum exame/consulta ativo.</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right Col: Date & Quantity */}
                            <div className="flex flex-col justify-between p-4 bg-slate-50/50 border border-slate-100 rounded-3xl min-h-0">
                                <div className="space-y-3 flex-1 min-h-0 pb-1.5">
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 ml-1">Data da Consulta/Exame</label>
                                        <div className="relative">
                                            <input
                                                type="date"
                                                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-slate-900 focus:border-sky-500 focus:ring-4 focus:ring-sky-500/5 outline-none transition-all text-xs font-bold"
                                                value={bookingDate}
                                                onChange={(e) => setBookingDate(e.target.value)}
                                                required
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1 ml-1">Prioridade do Agendamento</label>
                                        <div className="grid grid-cols-2 gap-2.5">
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
                                                        className={`py-2 px-3 rounded-xl border text-xs font-black uppercase tracking-wider transition-all duration-300 active:scale-95 text-center flex items-center justify-center gap-2 ${
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


                                    {/* Selection summary formatted as a premium ticket */}
                                    {selectedProcedure && (
                                        <div className="relative p-3.5 bg-gradient-to-b from-white to-slate-50/50 border border-slate-200/60 rounded-2xl space-y-2 shadow-md shadow-slate-100/40 overflow-hidden group">
                                            {/* Lateral ticket circle cutouts */}
                                            <div className="absolute top-1/2 -left-2.5 w-5 h-5 bg-slate-100 border-r border-slate-200/60 rounded-full -translate-y-1/2"></div>
                                            <div className="absolute top-1/2 -right-2.5 w-5 h-5 bg-slate-100 border-l border-slate-200/60 rounded-full -translate-y-1/2"></div>

                                            <h5 className="text-[9px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 pb-1.5 border-b border-dashed border-slate-200">
                                                <Ticket className="w-3 h-3 text-sky-500" />
                                                Resumo do Voucher
                                            </h5>
                                            <div className="space-y-1.5 pt-0.5 text-xs">
                                                <div className="flex justify-between items-center">
                                                    <span className="font-bold text-slate-400">Procedimento:</span>
                                                    <span className="font-black text-slate-800 truncate max-w-[170px] uppercase">{selectedProcedure.name}</span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="font-bold text-slate-400">Vagas Disponíveis:</span>
                                                    <span className={`font-black ${
                                                        getAvailableSlots(selectedProcedure, bookingPriority, bookingDate) > 0 
                                                        ? 'text-emerald-600' 
                                                        : 'text-rose-600'
                                                    }`}>
                                                        {getAvailableSlots(selectedProcedure, bookingPriority, bookingDate)} vagas
                                                    </span>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <span className="font-bold text-slate-400">Prioridade:</span>
                                                    <span className={`font-black uppercase text-[9px] px-2 py-0.5 rounded ${
                                                        bookingPriority === 'Urgência' ? 'bg-rose-500 text-white shadow-sm' : 'bg-slate-100 text-slate-700'
                                                    }`}>{bookingPriority}</span>
                                                </div>
                                                {bookingPriority === 'Normal' && !isLastWeekOfMonth(bookingDate) && selectedProcedure.available_quantity <= Math.ceil((selectedProcedure.total_quantity || selectedProcedure.available_quantity) * 0.20) && (
                                                    <div className="text-[10px] font-bold text-rose-600 bg-rose-50 border border-rose-100 p-2 rounded-lg mt-2 flex items-center gap-1.5 animate-pulse col-span-2">
                                                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                                        <span>Apenas vagas de urgência disponíveis. Altere a prioridade.</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="mt-4 flex justify-between shrink-0">
                                    <button
                                        onClick={() => setStep(1)}
                                        className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-extrabold rounded-2xl active:scale-95 transition-all text-xs uppercase tracking-wider"
                                    >
                                        Voltar
                                    </button>
                                    <button
                                        onClick={() => setStep(3)}
                                        disabled={
                                            !selectedProcedure || 
                                            !bookingDate || 
                                            (bookingPriority === 'Normal' 
                                                ? ((!isLastWeekOfMonth(bookingDate) && selectedProcedure.available_quantity <= Math.ceil((selectedProcedure.total_quantity || selectedProcedure.available_quantity) * 0.20)) || selectedProcedure.available_quantity < 1)
                                                : selectedProcedure.available_quantity < 1
                                            )
                                        }
                                        className="px-6 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-40 disabled:hover:bg-sky-600 text-white font-extrabold rounded-2xl shadow-lg shadow-sky-600/10 hover:shadow-sky-600/20 active:scale-95 disabled:active:scale-100 transition-all text-xs uppercase tracking-wider"
                                    >
                                        Revisar
                                    </button>
                                </div>
                            </div>
                        </div>
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
                                            <span className="text-sm font-black text-slate-800 uppercase">{selectedPatient?.name}</span>
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
                                                    {selectedPatient && new Date(selectedPatient.birth_date).toLocaleDateString('pt-BR')}
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
                                            <span className="text-sm font-black text-slate-800 truncate block uppercase">{selectedProcedure?.name}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <span className="block text-[8px] font-black text-slate-400 uppercase tracking-wider">Data do Atendimento</span>
                                                <span className="text-xs font-bold text-slate-700">
                                                    {bookingDate && new Date(bookingDate + 'T00:00:00').toLocaleDateString('pt-BR')}
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
                                onClick={() => setStep(2)}
                                className="px-5 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-extrabold rounded-2xl active:scale-95 transition-all text-xs uppercase tracking-wider"
                            >
                                Voltar
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
        </div>
    );
};
