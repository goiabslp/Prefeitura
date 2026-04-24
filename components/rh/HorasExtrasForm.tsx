import React, { useState, useRef, useEffect } from 'react';
import { Users, UserPlus, Save, Trash2, Calendar, FileText, Clock, ChevronRight, Search, Check, ChevronDown, X } from 'lucide-react';
import { User, AppState, Person, Job, Sector, RhHorasExtras, HorasExtrasEntry, HorasExtrasEntryStatus } from '../../types';

interface HorasExtrasFormProps {
    users: User[];
    persons: Person[];
    jobs: Job[];
    sectors: Sector[];
    userRole: string;
    currentUserId: string;
    onSave: (data: any) => void;
    onCancel: () => void;
    editingRecord?: RhHorasExtras | null;
    appState?: AppState;
}

export const HorasExtrasForm: React.FC<HorasExtrasFormProps> = ({
    users,
    persons,
    jobs,
    sectors,
    userRole,
    currentUserId,
    onSave,
    onCancel,
    editingRecord,
    appState
}) => {
    const months = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    const currentMonthIndex = new Date().getMonth();
    const currentMonthName = months[currentMonthIndex];

    const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthName);
    const [entries, setEntries] = useState<HorasExtrasEntry[]>([]);

    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [selectedHours, setSelectedHours] = useState<number>(1);
    const [selectedAdicionalNoturno, setSelectedAdicionalNoturno] = useState<number>(0);

    const [isUserOpen, setIsUserOpen] = useState(false);
    const [isHoursOpen, setIsHoursOpen] = useState(false);
    const [isAdicionalOpen, setIsAdicionalOpen] = useState(false);
    const [userSearch, setUserSearch] = useState('');
    const [pendingCedido, setPendingCedido] = useState<any | null>(null);
    const [pendingExcesso, setPendingExcesso] = useState<{ person: any, forceCedido: boolean } | null>(null);
    const [excessoJustificativa, setExcessoJustificativa] = useState('');

    const userDropdownRef = useRef<HTMLDivElement>(null);
    const hoursDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // As they are modals now, we don't necessarily need click-outside for dropdowns in the same way,
        // but we'll leave it empty or remove the old logic since we'll use backdrop clicks.
    }, []);

    useEffect(() => {
        if (editingRecord) {
            setSelectedMonth(editingRecord.month);
            setEntries(editingRecord.entries.map(e => ({
                ...e,
                // Ensure isCedido and adicionalNoturno are correctly interpreted if it was stored
                isCedido: e.isCedido || false,
                adicionalNoturno: e.adicionalNoturno || 0
            })));
        } else {
            setSelectedMonth(currentMonthName);
            setEntries([]);
        }
    }, [editingRecord, currentMonthName]);

    const currentUser = users.find(u => u.id === currentUserId);
    const currentUserSectorId = currentUser?.sectorId || sectors.find(s => s.name === currentUser?.sector)?.id;
    const currentUserSectorName = currentUser?.sector || sectors.find(s => s.id === currentUserSectorId)?.name || 'Geral';

    const allMappedPersons = persons.map(person => {
        const job = jobs.find(j => j.id === person.jobId);
        const sector = sectors.find(s => s.id === person.sectorId);
        return {
            id: person.id,
            name: person.name,
            jobTitle: job?.name || person.role || 'Sem cargo',
            sector: sector?.name || 'Geral',
            sectorId: person.sectorId
        };
    });

    const accessiblePersons = allMappedPersons;

    const availableUsersForAdd = accessiblePersons.filter(p => !entries.some(e => e.userId === p.id));

    const handleAddEntry = (forceCedido: boolean = false, overrideExcesso: boolean = false) => {
        const userIdToUse = forceCedido && pendingCedido ? pendingCedido.id : (pendingExcesso ? pendingExcesso.person.id : selectedUserId);
        if (!userIdToUse || selectedHours <= 0) return;

        const selectedPerson = allMappedPersons.find(p => p.id === userIdToUse);
        const isActuallyCedido = selectedPerson?.sectorId !== currentUserSectorId;

        if (isActuallyCedido && !forceCedido) {
            setPendingCedido(selectedPerson);
            return;
        }

        // Check 16h limit for Motoristas/Operadores
        const jobTitleLower = (selectedPerson?.jobTitle || '').toLowerCase();
        const isRestrictedRole = jobTitleLower.includes('motorista') || jobTitleLower.includes('operador');
        
        if (isRestrictedRole && selectedHours > 16 && !overrideExcesso) {
            setPendingExcesso({ person: selectedPerson, forceCedido });
            setExcessoJustificativa('');
            return; // Interrupt normal flow
        }

        setEntries([...entries, {
            userId: userIdToUse,
            name: selectedPerson?.name || 'Sistema',
            jobTitle: selectedPerson?.jobTitle || 'Colaborador',
            sector: selectedPerson?.sector || 'Geral',
            hours: selectedHours,
            adicionalNoturno: selectedAdicionalNoturno,
            isCedido: forceCedido || isActuallyCedido,
            status: (isRestrictedRole && selectedHours > 16) ? 'Pendente' : 'Aprovado',
            justificativa: (isRestrictedRole && selectedHours > 16) ? excessoJustificativa : undefined
        }]);

        setSelectedUserId('');
        setSelectedHours(1);
        setSelectedAdicionalNoturno(0);
        setPendingCedido(null);
        setPendingExcesso(null);
        setExcessoJustificativa('');
    };

    const approveEntry = (index: number) => {
        const newEntries = [...entries];
        newEntries[index].status = 'Aprovado';
        setEntries(newEntries);
    };

    const removeEntry = (index: number) => {
        const newEntries = [...entries];
        newEntries.splice(index, 1);
        setEntries(newEntries);
    };

    const handleSave = () => {
        if (!selectedMonth) {
            alert("Por favor, selecione o mês referente.");
            return;
        }

        const validEntries = entries.filter(e => e.userId && e.hours > 0 && e.hours <= 300);

        if (validEntries.length === 0) {
            alert("Adicione pelo menos um colaborador com horas válidas.");
            return;
        }

        onSave({
            id: editingRecord?.id,
            month: selectedMonth,
            entries: validEntries,
            sector: editingRecord?.sector || currentUserSectorName
        });
    };

    const totalHours = entries.reduce((acc, curr) => acc + curr.hours, 0);

    return (
        <div className="w-full max-w-7xl mx-auto animate-fade-in flex flex-col h-full pb-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 flex-1 items-start">

                {/* Left Column - Form & Inclusion */}
                <div className="lg:col-span-2 bg-white rounded-3xl shadow-sm border border-slate-100 p-6 desktop:p-10 flex flex-col min-h-[600px] relative">

                    {/* Header */}
                    <div className="flex items-center gap-4 mb-8 pb-6 border-b border-slate-100">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-fuchsia-500 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-fuchsia-500/30">
                            <Calendar className="w-7 h-7" />
                        </div>
                        <div>
                            <h1 className="text-2xl desktop:text-3xl font-bold text-slate-800 tracking-tight">LANÇAMENTO DE ROTINAS</h1>
                            <p className="text-slate-500 font-medium flex items-center gap-2 mt-1">
                                <span className="bg-slate-100 px-2 py-0.5 flex items-center rounded-md font-bold text-slate-700 text-xs uppercase tracking-wider">{userRole === 'admin' ? 'Acesso Total (Admin)' : currentUserSectorName}</span>
                                Lançamento de horas extras
                            </p>
                        </div>
                    </div>

                    {/* Month Selection */}
                    <div className="mb-8">
                        <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wider">Mês de Referência</label>
                        <div className="relative">
                            <div className={`w-full h-14 pl-12 pr-4 bg-slate-100 border-2 border-slate-200 text-slate-500 text-base rounded-2xl flex items-center font-bold ${editingRecord ? 'opacity-80' : 'cursor-not-allowed select-none'}`}>
                                {selectedMonth} {selectedMonth === currentMonthName && !editingRecord ? '(Mês Atual)' : ''}
                            </div>
                            <Calendar className="w-6 h-6 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                        </div>
                    </div>

                    {/* Inclusion Form */}
                    <div className="transition-all duration-500 opacity-100 translate-y-0">
                        <div className="bg-slate-50 p-6 rounded-3xl border-2 border-dashed border-slate-200">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-6">
                                <UserPlus className="w-5 h-5 text-fuchsia-500" />
                                Adicionar Colaborador
                            </h3>

                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                {/* Custom Collaborator Select */}
                                <div className="md:col-span-6 relative group" ref={userDropdownRef}>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Colaborador</label>
                                    <div
                                        onClick={() => {
                                            if (availableUsersForAdd.length > 0) {
                                                setIsUserOpen(!isUserOpen);
                                                setIsHoursOpen(false);
                                            }
                                        }}
                                        className={`w-full h-12 pl-10 pr-10 bg-white border ${isUserOpen ? 'border-fuchsia-400 ring-2 ring-fuchsia-100' : 'border-slate-200'} text-slate-700 text-sm rounded-xl transition-all font-medium shadow-sm hover:border-slate-300 cursor-pointer flex items-center justify-between ${availableUsersForAdd.length === 0 ? 'opacity-70 bg-slate-100 cursor-not-allowed' : ''}`}
                                    >
                                        <div className="flex items-center overflow-hidden">
                                            <Users className={`w-4 h-4 absolute left-3.5 transition-colors ${isUserOpen || selectedUserId ? 'text-fuchsia-500' : 'text-slate-400 group-hover:text-fuchsia-500'}`} />
                                            {selectedUserId ? (
                                                <span className="truncate">{allMappedPersons.find(p => p.id === selectedUserId)?.name}</span>
                                            ) : (
                                                <span className="text-slate-400">Selecione um colaborador...</span>
                                            )}
                                        </div>
                                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isUserOpen ? 'rotate-180 text-fuchsia-500' : ''}`} />
                                    </div>

                                    {/* User Dropdown Menu -> Moved to Modal at bottom */}
                                </div>

                                <div className="md:col-span-3 relative group" ref={hoursDropdownRef}>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Quantidade</label>
                                    <div
                                        onClick={() => {
                                            setIsHoursOpen(!isHoursOpen);
                                            setIsUserOpen(false);
                                        }}
                                        className={`w-full h-12 pl-9 pr-7 bg-white border ${isHoursOpen ? 'border-fuchsia-400 ring-2 ring-fuchsia-100' : 'border-slate-200'} text-slate-700 text-sm rounded-xl transition-all font-medium shadow-sm hover:border-slate-300 cursor-pointer flex items-center justify-between`}
                                    >
                                        <div className="flex items-center">
                                            <Clock className={`w-4 h-4 absolute left-3 transition-colors ${isHoursOpen || selectedHours ? 'text-fuchsia-500' : 'text-slate-400 group-hover:text-fuchsia-500'}`} />
                                            <span>{selectedHours.toString().padStart(2, '0')} hrs</span>
                                        </div>
                                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isHoursOpen ? 'rotate-180 text-fuchsia-500' : ''}`} />
                                    </div>

                                    {/* Hours Dropdown Menu -> Moved to Modal at bottom */}
                                </div>

                                {/* Adicional Noturno Select */}
                                <div className="md:col-span-3 relative group" id="adicional-dropdown">
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Adicional Noturno</label>
                                    <div
                                        onClick={() => {
                                            setIsAdicionalOpen(!isAdicionalOpen);
                                            setIsUserOpen(false);
                                            setIsHoursOpen(false);
                                        }}
                                        className={`w-full h-12 pl-9 pr-7 bg-white border ${isAdicionalOpen ? 'border-fuchsia-400 ring-2 ring-fuchsia-100' : 'border-slate-200'} text-slate-700 text-sm rounded-xl transition-all font-medium shadow-sm hover:border-slate-300 cursor-pointer flex items-center justify-between`}
                                    >
                                        <div className="flex items-center min-w-0 max-w-full overflow-hidden">
                                            <Clock className={`w-4 h-4 absolute left-3 transition-colors ${isAdicionalOpen || selectedAdicionalNoturno ? 'text-indigo-500' : 'text-slate-400 group-hover:text-indigo-500'}`} />
                                            <span className="truncate whitespace-nowrap">{selectedAdicionalNoturno > 0 ? `${selectedAdicionalNoturno}h` : 'Nenhum'}</span>
                                        </div>
                                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isAdicionalOpen ? 'rotate-180 text-indigo-500' : ''}`} />
                                    </div>

                                    {/* Adicional Noturno Modal -> Moved to bottom */}
                                </div>
                            </div>

                            <button
                                onClick={() => handleAddEntry()}
                                disabled={!selectedUserId}
                                className="w-full mt-6 py-3 bg-slate-800 text-white font-bold rounded-xl shadow-md hover:bg-slate-700 transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 group"
                            >
                                <UserPlus className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                Adicionar Colaborador
                            </button>

                            <div className="grid grid-cols-2 gap-4 mt-4">
                                <button
                                    onClick={onCancel}
                                    className="py-3 px-4 font-bold text-slate-600 bg-white border-2 border-slate-200 hover:bg-slate-50 hover:border-slate-300 rounded-xl transition-all text-sm"
                                >
                                    Cancelar
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={entries.length === 0 || !selectedMonth}
                                    className="flex items-center justify-center gap-2 py-3 px-4 font-bold text-white bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 rounded-xl transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 text-sm"
                                >
                                    <Save className="w-4 h-4" />
                                    Finalizar e Salvar
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1"></div>
                </div>

                {/* Right Column - Entered List */}
                <div className="lg:col-span-1 bg-white rounded-3xl shadow-sm border border-slate-100 flex flex-col h-full max-h-[800px] sticky top-8">
                    <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between rounded-t-3xl">
                        <div>
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                <Users className="w-5 h-5 text-indigo-500" />
                                Adicionados
                            </h3>
                            <p className="text-xs font-medium text-slate-500 mt-1">{entries.length} colaborador(es)</p>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-lg" title="Total de horas">
                            {totalHours}h
                        </div>
                    </div>

                    <div className="p-4 flex-1 overflow-y-auto custom-scrollbar min-h-[400px]">
                        {entries.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                                <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                                    <Users className="w-8 h-8 text-slate-300" />
                                </div>
                                <p className="font-medium text-sm text-slate-500">Nenhum adicionado ainda.</p>
                                <p className="text-xs mt-2 opacity-80 leading-relaxed max-w-[200px]">Utilize o formulário ao lado para incluir colaboradores.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {entries.map((entry, index) => {
                                    return (
                                        <div key={index} className={`group relative flex items-start p-4 bg-white border ${entry.status === 'Pendente' ? 'border-amber-200 bg-amber-50/30' : 'border-slate-100 hover:border-indigo-100'} rounded-2xl shadow-sm hover:shadow-md transition-all animate-in slide-in-from-right-4 duration-300`}>
                                            {/* Avatar initial */}
                                            <div className={`w-10 h-10 rounded-full ${entry.status === 'Pendente' ? 'bg-amber-100 text-amber-600' : 'bg-indigo-50 text-indigo-600'} flex items-center justify-center font-bold text-sm shrink-0 mr-3 mt-0.5`}>
                                                {entry.name?.charAt(0) || 'U'}
                                            </div>

                                            <div className="flex-1 min-w-0 pr-8">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <p className="font-bold text-slate-800 text-sm leading-tight">{entry.name || 'Desconhecido'}</p>
                                                    {entry.status === 'Pendente' && (
                                                        <span className="text-[9px] font-black text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded uppercase tracking-widest border border-amber-200">
                                                            Pendente
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                    <p className="text-[10px] uppercase font-bold text-slate-400">{entry.jobTitle || 'Sem cargo'}</p>
                                                    
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                        <p className={`text-xs font-bold whitespace-nowrap ${entry.status === 'Pendente' ? 'text-amber-600' : 'text-fuchsia-600'}`}>{entry.hours} hrs</p>
                                                    </div>

                                                    {entry.adicionalNoturno > 0 && (
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                            <p className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 uppercase tracking-tighter whitespace-nowrap">
                                                                {entry.adicionalNoturno}h Noturno
                                                            </p>
                                                        </div>
                                                    )}

                                                    {entry.isCedido && (
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                            <span className="text-[9px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 uppercase tracking-tighter whitespace-nowrap">Cedido</span>
                                                        </div>
                                                    )}
                                                    
                                                    {userRole === 'admin' && (
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                            <p className="text-[10px] font-bold text-slate-400">{entry.sector}</p>
                                                        </div>
                                                    )}
                                                </div>

                                                {entry.status === 'Pendente' && entry.justificativa && (
                                                    <div className="mt-2 bg-white/60 p-2.5 rounded-lg border border-amber-100 text-xs text-amber-900 shadow-sm relative overflow-hidden">
                                                        <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-amber-400"></div>
                                                        <p className="font-bold mb-0.5 text-[10px] uppercase tracking-wider opacity-70">Justificativa do Excesso:</p>
                                                        <p className="italic">"{entry.justificativa}"</p>
                                                    </div>
                                                )}

                                                {entry.status === 'Pendente' && userRole === 'admin' && (
                                                    <button
                                                        onClick={() => approveEntry(index)}
                                                        className="mt-3 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg shadow-sm transition-colors flex items-center gap-1.5"
                                                    >
                                                        <Check className="w-3.5 h-3.5" />
                                                        Aprovar Excesso
                                                    </button>
                                                )}
                                            </div>

                                            <button
                                                onClick={() => removeEntry(index)}
                                                className={`absolute right-3 top-3 p-2 rounded-xl transition-all opacity-0 group-hover:opacity-100 ${entry.status === 'Pendente' ? 'text-amber-400 hover:text-amber-600 hover:bg-amber-100' : 'text-slate-300 hover:text-rose-500 hover:bg-rose-50'}`}
                                                title="Remover"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {/* Confirmation Modal for Cedidos */}
            {pendingCedido && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 animate-scale-in">
                        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mb-6 mx-auto">
                            <Users className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 text-center mb-2 uppercase tracking-tight">Colaborador Cedido</h3>
                        <p className="text-slate-500 text-center text-sm mb-8 font-medium leading-relaxed">
                            O colaborador <span className="text-slate-800 font-bold">{pendingCedido.name}</span> pertence ao setor <span className="text-indigo-600 font-bold">{pendingCedido.sector}</span>. 
                            <br/><br/>
                            Ao confirmar, ele será adicionado a este relatório como <span className="text-amber-600 font-bold uppercase italic text-xs">Colaborador Cedido</span>.
                        </p>
                        
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => setPendingCedido(null)}
                                className="py-3.5 px-6 font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-all text-sm border border-slate-200"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => handleAddEntry(true)}
                                className="py-3.5 px-6 font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-2xl transition-all shadow-lg hover:shadow-slate-900/20 text-sm flex items-center justify-center gap-2"
                            >
                                <Check className="w-4 h-4" />
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Confirmation Modal for Excesso de Horas */}
            {pendingExcesso && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 animate-scale-in">
                        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mb-6 mx-auto">
                            <Clock className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-black text-slate-800 text-center mb-2 uppercase tracking-tight">Excesso de Horas Extras</h3>
                        <p className="text-slate-500 text-center text-sm mb-6 font-medium leading-relaxed">
                            O cargo <span className="text-indigo-600 font-bold">{pendingExcesso.person.jobTitle}</span> possui um limite padrão de 16 horas. O lançamento atual para <span className="text-slate-800 font-bold">{pendingExcesso.person.name}</span> é de <span className="text-rose-600 font-bold">{selectedHours} horas</span>.
                            <br/><br/>
                            Por favor, informe a justificativa obrigatória. O lançamento ficará pendente de aprovação.
                        </p>
                        
                        <div className="mb-6">
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Justificativa <span className="text-rose-500">*</span></label>
                            <textarea
                                value={excessoJustificativa}
                                onChange={(e) => setExcessoJustificativa(e.target.value)}
                                placeholder="Descreva o motivo do excesso de horas..."
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm min-h-[100px] resize-none focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => { setPendingExcesso(null); setExcessoJustificativa(''); }}
                                className="py-3.5 px-6 font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-all text-sm border border-slate-200"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => {
                                    if (!excessoJustificativa.trim()) {
                                        alert("A justificativa é obrigatória.");
                                        return;
                                    }
                                    handleAddEntry(pendingExcesso.forceCedido, true);
                                }}
                                disabled={!excessoJustificativa.trim()}
                                className="py-3.5 px-6 font-bold text-white bg-amber-500 hover:bg-amber-600 rounded-2xl transition-all shadow-lg hover:shadow-amber-500/20 text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Check className="w-4 h-4" />
                                Salvar Pendente
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Selecionar Colaborador */}
            {isUserOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in p-4">
                    {/* Overlay clickable */}
                    <div className="absolute inset-0" onClick={() => setIsUserOpen(false)}></div>
                    <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl relative flex flex-col max-h-[80vh] overflow-hidden animate-scale-in">
                        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div>
                                <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Colaborador</h3>
                                <p className="text-xs font-bold text-slate-400 uppercase mt-1">Selecione para lançar horas</p>
                            </div>
                            <button
                                onClick={() => setIsUserOpen(false)}
                                className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 hover:border-slate-300 transition-all shadow-sm"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="p-4 border-b border-slate-100">
                            <div className="relative">
                                <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Buscar nome ou cargo..."
                                    value={userSearch}
                                    onChange={(e) => setUserSearch(e.target.value)}
                                    className="w-full text-base py-3 pl-12 pr-4 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-fuchsia-100 focus:border-fuchsia-400 font-medium"
                                />
                                {userSearch && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setUserSearch(''); }}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-300 hover:text-slate-700 transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="overflow-y-auto p-2 custom-scrollbar flex-1 bg-[#f8fafc]">
                            {availableUsersForAdd.filter(u =>
                                u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
                                (u.jobTitle || '').toLowerCase().includes(userSearch.toLowerCase())
                            ).length > 0 ? (
                                <div className="space-y-2 p-2">
                                    {availableUsersForAdd.filter(u =>
                                        u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
                                        (u.jobTitle || '').toLowerCase().includes(userSearch.toLowerCase())
                                    ).map(u => (
                                        <div
                                            key={u.id}
                                            onClick={() => {
                                                setSelectedUserId(u.id);
                                                setIsUserOpen(false);
                                                setUserSearch('');
                                            }}
                                            className={`flex flex-col p-4 rounded-2xl cursor-pointer transition-all border ${selectedUserId === u.id ? 'bg-fuchsia-50 border-fuchsia-200 shadow-sm' : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-md'}`}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className={`text-base font-bold ${selectedUserId === u.id ? 'text-fuchsia-700' : 'text-slate-800'}`}>{u.name}</span>
                                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedUserId === u.id ? 'border-fuchsia-500 bg-fuchsia-500 text-white' : 'border-slate-300'}`}>
                                                    {selectedUserId === u.id && <Check className="w-3 h-3" />}
                                                </div>
                                            </div>
                                            <span className="text-sm text-slate-500 font-medium">{u.jobTitle || 'Sem cargo'}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 flex flex-col items-center justify-center text-center h-full">
                                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                                        <Search className="w-8 h-8 text-slate-300" />
                                    </div>
                                    <p className="font-bold text-slate-600">Nenhum colaborador encontrado.</p>
                                    <p className="text-sm text-slate-400 mt-2 max-w-[200px]">Tente buscar por outro nome ou cargo.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Selecionar Quantidade de Horas */}
            {isHoursOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in p-4">
                    <div className="absolute inset-0" onClick={() => setIsHoursOpen(false)}></div>
                    <div className="bg-[#f8fafc] w-full max-w-lg rounded-3xl shadow-2xl relative flex flex-col max-h-[80vh] overflow-hidden animate-scale-in border border-slate-200">
                        <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-white">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-fuchsia-50 text-fuchsia-600 flex items-center justify-center">
                                    <Clock className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Quantidade</h3>
                                    <p className="text-xs font-bold text-slate-400 uppercase mt-1">Horas Extras</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsHoursOpen(false)}
                                className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 hover:border-slate-300 transition-all shadow-sm"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="overflow-y-auto p-4 custom-scrollbar flex-1">
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                                {Array.from({ length: 50 }, (_, i) => i + 1).map(h => (
                                    <button
                                        key={h}
                                        onClick={() => {
                                            setSelectedHours(h);
                                            setIsHoursOpen(false);
                                        }}
                                        className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all font-bold ${
                                            selectedHours === h 
                                            ? 'border-fuchsia-500 bg-fuchsia-500 text-white shadow-md transform scale-105' 
                                            : 'border-slate-200 bg-white text-slate-600 hover:border-fuchsia-300 hover:bg-fuchsia-50'
                                        }`}
                                    >
                                        <span className={`text-xl ${selectedHours === h ? 'text-white' : 'text-slate-800'}`}>
                                            {h}
                                        </span>
                                        <span className={`text-[10px] uppercase tracking-wider mt-1 ${selectedHours === h ? 'text-fuchsia-100' : 'text-slate-400'}`}>
                                            {h === 1 ? 'Hora' : 'Horas'}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal: Selecionar Adicional Noturno */}
            {isAdicionalOpen && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fade-in p-4">
                    <div className="absolute inset-0" onClick={() => setIsAdicionalOpen(false)}></div>
                    <div className="bg-[#f8fafc] w-full max-w-lg rounded-3xl shadow-2xl relative flex flex-col max-h-[80vh] overflow-hidden animate-scale-in border border-slate-200">
                        <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-white">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                    <Clock className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Adicional Noturno</h3>
                                    <p className="text-xs font-bold text-slate-400 uppercase mt-1">Horas Noturnas</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsAdicionalOpen(false)}
                                className="w-10 h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 hover:border-slate-300 transition-all shadow-sm"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        
                        <div className="overflow-y-auto p-4 custom-scrollbar flex-1">
                            <button
                                onClick={() => {
                                    setSelectedAdicionalNoturno(0);
                                    setIsAdicionalOpen(false);
                                }}
                                className={`w-full flex items-center justify-between p-4 mb-4 rounded-2xl border-2 transition-all font-bold ${
                                    selectedAdicionalNoturno === 0 
                                    ? 'border-indigo-600 bg-indigo-600 text-white shadow-md' 
                                    : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50'
                                }`}
                            >
                                <span className="text-lg">Sem Adicional Noturno</span>
                                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedAdicionalNoturno === 0 ? 'border-white bg-indigo-500 text-white' : 'border-slate-300'}`}>
                                    {selectedAdicionalNoturno === 0 && <Check className="w-3 h-3" />}
                                </div>
                            </button>

                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                                {Array.from({ length: 150 }, (_, i) => i + 1).map(h => (
                                    <button
                                        key={h}
                                        onClick={() => {
                                            setSelectedAdicionalNoturno(h);
                                            setIsAdicionalOpen(false);
                                        }}
                                        className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all font-bold ${
                                            selectedAdicionalNoturno === h 
                                            ? 'border-indigo-500 bg-indigo-500 text-white shadow-md transform scale-105' 
                                            : 'border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50'
                                        }`}
                                    >
                                        <span className={`text-xl ${selectedAdicionalNoturno === h ? 'text-white' : 'text-slate-800'}`}>
                                            {h}
                                        </span>
                                        <span className={`text-[10px] uppercase tracking-wider mt-1 ${selectedAdicionalNoturno === h ? 'text-indigo-100' : 'text-slate-400'}`}>
                                            {h === 1 ? 'Hora' : 'Horas'}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
