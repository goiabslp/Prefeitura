import React, { useState, useRef, useEffect } from 'react';
import { Users, UserPlus, Save, Trash2, Calendar, FileText, Clock, ChevronRight, Search, Check, ChevronDown, X } from 'lucide-react';
import { User, AppState, Person, Job, Sector, RhHorasExtras } from '../../types';

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
    const [entries, setEntries] = useState<{ userId: string, name: string, jobTitle: string, sector: string, hours: number, isCedido?: boolean }[]>([]);

    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [selectedHours, setSelectedHours] = useState<number>(1);

    const [isUserOpen, setIsUserOpen] = useState(false);
    const [isHoursOpen, setIsHoursOpen] = useState(false);
    const [userSearch, setUserSearch] = useState('');
    const [pendingCedido, setPendingCedido] = useState<any | null>(null);

    const userDropdownRef = useRef<HTMLDivElement>(null);
    const hoursDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
                setIsUserOpen(false);
            }
            if (hoursDropdownRef.current && !hoursDropdownRef.current.contains(event.target as Node)) {
                setIsHoursOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (editingRecord) {
            setSelectedMonth(editingRecord.month);
            setEntries(editingRecord.entries.map(e => ({
                ...e,
                // Ensure isCedido is correctly interpreted if it was stored
                isCedido: e.isCedido || false
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

    const handleAddEntry = (forceCedido: boolean = false) => {
        const userIdToUse = forceCedido ? pendingCedido?.id : selectedUserId;
        if (!userIdToUse || selectedHours <= 0) return;

        const selectedPerson = allMappedPersons.find(p => p.id === userIdToUse);
        const isActuallyCedido = selectedPerson?.sectorId !== currentUserSectorId;

        if (isActuallyCedido && !forceCedido) {
            setPendingCedido(selectedPerson);
            return;
        }

        setEntries([...entries, {
            userId: userIdToUse,
            name: selectedPerson?.name || 'Sistema',
            jobTitle: selectedPerson?.jobTitle || 'Colaborador',
            sector: selectedPerson?.sector || 'Geral',
            hours: selectedHours,
            isCedido: isActuallyCedido
        }]);

        setSelectedUserId('');
        setSelectedHours(1);
        setPendingCedido(null);
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
                            <div className="w-full h-14 pl-12 pr-4 bg-slate-100 border-2 border-slate-200 text-slate-500 text-base rounded-2xl flex items-center font-bold cursor-not-allowed select-none">
                                {selectedMonth} (Mês Atual)
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
                                <div className="md:col-span-7 relative group" ref={userDropdownRef}>
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

                                    {/* User Dropdown Menu */}
                                    {isUserOpen && (
                                        <div className="absolute z-50 w-full bottom-full mb-2 bg-white border border-slate-200 rounded-xl shadow-xl shadow-slate-200/50 overflow-hidden animate-fade-in-up origin-bottom">
                                            <div className="p-2 border-b border-slate-100">
                                                <div className="relative">
                                                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                                    <input
                                                        type="text"
                                                        autoFocus
                                                        placeholder="Buscar nome ou cargo..."
                                                        value={userSearch}
                                                        onChange={(e) => setUserSearch(e.target.value)}
                                                        className="w-full text-sm py-2 pl-9 pr-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-fuchsia-100 focus:border-fuchsia-400"
                                                    />
                                                    {userSearch && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setUserSearch(''); }}
                                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                                        >
                                                            <X className="w-3.5 h-3.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="max-h-60 overflow-y-auto p-1 custom-scrollbar">
                                                {availableUsersForAdd.filter(u =>
                                                    u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
                                                    (u.jobTitle || '').toLowerCase().includes(userSearch.toLowerCase())
                                                ).length > 0 ? (
                                                    availableUsersForAdd.filter(u =>
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
                                                            className={`flex flex-col px-3 py-2 rounded-lg cursor-pointer transition-colors ${selectedUserId === u.id ? 'bg-fuchsia-50' : 'hover:bg-slate-50 text-slate-700'}`}
                                                        >
                                                            <div className="flex items-center justify-between">
                                                                <span className={`text-sm font-bold ${selectedUserId === u.id ? 'text-fuchsia-700' : 'text-slate-800'}`}>{u.name}</span>
                                                                {selectedUserId === u.id && <Check className="w-4 h-4 text-fuchsia-600" />}
                                                            </div>
                                                            <span className="text-xs text-slate-500 font-medium">{u.jobTitle || 'Sem cargo'}</span>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="px-4 py-6 text-center text-sm text-slate-500">
                                                        Nenhum colaborador encontrado.
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                    {availableUsersForAdd.length === 0 && accessiblePersons.length > 0 && (
                                        <p className="text-xs text-emerald-500 mt-2 font-medium">Todos os colaboradores já foram adicionados.</p>
                                    )}
                                </div>

                                {/* Custom Hours Select */}
                                <div className="md:col-span-5 relative group" ref={hoursDropdownRef}>
                                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Quantidade</label>
                                    <div
                                        onClick={() => {
                                            setIsHoursOpen(!isHoursOpen);
                                            setIsUserOpen(false);
                                        }}
                                        className={`w-full h-12 pl-10 pr-10 bg-white border ${isHoursOpen ? 'border-fuchsia-400 ring-2 ring-fuchsia-100' : 'border-slate-200'} text-slate-700 text-sm rounded-xl transition-all font-medium shadow-sm hover:border-slate-300 cursor-pointer flex items-center justify-between`}
                                    >
                                        <div className="flex items-center">
                                            <Clock className={`w-4 h-4 absolute left-3.5 transition-colors ${isHoursOpen || selectedHours ? 'text-fuchsia-500' : 'text-slate-400 group-hover:text-fuchsia-500'}`} />
                                            <span>{selectedHours.toString().padStart(2, '0')} hrs</span>
                                        </div>
                                        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${isHoursOpen ? 'rotate-180 text-fuchsia-500' : ''}`} />
                                    </div>

                                    {/* Hours Dropdown Menu */}
                                    {isHoursOpen && (
                                        <div className="absolute z-50 w-full bottom-full mb-2 bg-white border border-slate-200 rounded-xl shadow-xl shadow-slate-200/50 overflow-hidden animate-fade-in-up origin-bottom">
                                            <div className="max-h-56 overflow-y-auto p-1 grid grid-cols-2 gap-1 custom-scrollbar">
                                                {Array.from({ length: 50 }, (_, i) => i + 1).map(h => (
                                                    <div
                                                        key={h}
                                                        onClick={() => {
                                                            setSelectedHours(h);
                                                            setIsHoursOpen(false);
                                                        }}
                                                        className={`flex items-center justify-center py-2 rounded-lg cursor-pointer transition-colors text-sm font-medium ${selectedHours === h ? 'bg-fuchsia-500 text-white shadow-sm' : 'hover:bg-slate-50 text-slate-700'}`}
                                                    >
                                                        {h.toString().padStart(2, '0')} hrs
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
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
                                        <div key={index} className="group relative flex items-center p-4 bg-white border border-slate-100 hover:border-indigo-100 rounded-2xl shadow-sm hover:shadow-md transition-all animate-in slide-in-from-right-4 duration-300">
                                            {/* Avatar initial */}
                                            <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm shrink-0 mr-3">
                                                {entry.name?.charAt(0) || 'U'}
                                            </div>

                                            <div className="flex-1 min-w-0 pr-10">
                                                <p className="font-bold text-slate-800 text-sm truncate">{entry.name || 'Desconhecido'}</p>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <p className="text-[10px] uppercase font-bold text-slate-400 truncate max-w-[100px]">{entry.jobTitle || 'Sem cargo'}</p>
                                                    <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                    <p className="text-xs font-bold text-fuchsia-600">{entry.hours} hrs</p>
                                                    {entry.isCedido && (
                                                        <>
                                                            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                            <span className="text-[9px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100 uppercase tracking-tighter">Cedido</span>
                                                        </>
                                                    )}
                                                    {userRole === 'admin' && (
                                                        <>
                                                            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                                            <p className="text-[10px] font-bold text-slate-400 truncate max-w-[100px]">{entry.sector}</p>
                                                        </>
                                                    )}
                                                </div>
                                            </div>

                                            <button
                                                onClick={() => removeEntry(index)}
                                                className="absolute right-4 p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
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
        </div>
    );
};
