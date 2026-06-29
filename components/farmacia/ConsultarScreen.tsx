import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, FarmaciaMedicamento } from '../../types';
import { ArrowLeft, Search, AlertTriangle, CheckCircle2, XCircle, Info, RefreshCw } from 'lucide-react';
import * as db from '../../services/farmaciaService';

interface ConsultarScreenProps {
    currentUser: User;
    onBack: () => void;
    appState: any;
}

export const ConsultarScreen: React.FC<ConsultarScreenProps> = ({
    currentUser,
    onBack
}) => {
    const [medicamentos, setMedicamentos] = useState<FarmaciaMedicamento[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    const loadMedicamentos = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const data = await db.getMedicamentos();
            setMedicamentos(data);
        } catch (error) {
            console.error('Error fetching medicamentos:', error);
        } finally {
            setLoading(false);
        }
    };

    // Load on mount and register realtime listener
    useEffect(() => {
        loadMedicamentos();

        const handleRealtimeChange = () => {
            loadMedicamentos(true);
        };

        window.addEventListener('farmacia-medicamentos-changed', handleRealtimeChange);
        return () => {
            window.removeEventListener('farmacia-medicamentos-changed', handleRealtimeChange);
        };
    }, []);

    // Focus search input on mount
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault(); // Prevents page reload on pressing Enter
    };

    const handleClearSearch = () => {
        setSearchQuery('');
        setTimeout(() => {
            if (inputRef.current) inputRef.current.focus();
        }, 50);
    };

    // Determine search activation status dynamically
    const hasSearched = searchQuery.trim().length > 0;

    // Group matching lotes by medicine name dynamically in real-time
    const searchResults = useMemo(() => {
        const term = searchQuery.trim().toLowerCase();
        if (!term) return [];

        // Filter medicamentos matching query (name or lote or principio_ativo)
        const matched = medicamentos.filter(med => {
            // Não deve retornar medicamentos inativos ou com estoque zerado
            if (med.quantidade === 0) return false;

            const matchAtStart = (str: string | undefined | null) => {
                if (!str) return false;
                const lowerStr = str.toLowerCase();
                return lowerStr.startsWith(term) || lowerStr.includes(` ${term}`);
            };

            return matchAtStart(med.nome) || 
                   matchAtStart(med.lote) ||
                   matchAtStart(med.principio_ativo);
        });

        // Group by name and dosage (case insensitive key)
        const groups: Record<string, {
            nome: string;
            dosagem?: string;
            categoria: string;
            quantidadeTotal: number;
            unidade: string;
            lotes: FarmaciaMedicamento[];
        }> = {};

        matched.forEach(med => {
            const nameKey = `${med.nome.toUpperCase()}::${(med.dosagem || '').toUpperCase()}`;
            if (!groups[nameKey]) {
                groups[nameKey] = {
                    nome: med.nome,
                    dosagem: med.dosagem,
                    categoria: med.categoria,
                    quantidadeTotal: 0,
                    unidade: med.unidade,
                    lotes: []
                };
            }
            groups[nameKey].quantidadeTotal += med.quantidade;
            groups[nameKey].lotes.push(med);
        });

        return Object.values(groups);
    }, [medicamentos, searchQuery]);

    const getStockStatus = (quantidade: number, limiteMinimo: number) => {
        if (quantidade === 0) {
            return {
                label: 'Indisponível',
                colorClass: 'bg-rose-50 text-rose-700 border-rose-100',
                textClass: 'text-rose-600',
                icon: <XCircle className="w-4 h-4" />
            };
        }
        if (quantidade <= limiteMinimo) {
            return {
                label: 'Baixo estoque',
                colorClass: 'bg-amber-50 text-amber-700 border-amber-100',
                textClass: 'text-amber-600',
                icon: <AlertTriangle className="w-4 h-4" />
            };
        }
        return {
            label: 'Disponível',
            colorClass: 'bg-emerald-50 text-emerald-700 border-emerald-100',
            textClass: 'text-emerald-600',
            icon: <CheckCircle2 className="w-4 h-4" />
        };
    };

    const formatDateBr = (dateStr: string) => {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length !== 3) return dateStr;
        const [year, month, day] = parts;
        return `${day}/${month}/${year}`;
    };

    return (
        <div className="w-full mx-auto flex flex-col flex-1 h-full max-h-full min-h-0 bg-white rounded-3xl border border-slate-200/80 shadow-xl overflow-hidden animate-in fade-in duration-300">
            {/* Header / Title bar */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="p-2 -ml-2 text-slate-400 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-all"
                        title="Voltar"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h3 className="font-extrabold text-slate-900 tracking-tight text-lg flex items-center gap-2">
                            Consultar Medicamentos
                            <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-500"></span>
                            </span>
                        </h3>
                        <p className="text-xs text-slate-500 font-medium">Consulte disponibilidade e quantidade em tempo real</p>
                    </div>
                </div>
                <button
                    onClick={() => loadMedicamentos(true)}
                    className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-all"
                    title="Atualizar dados"
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            {/* Central Search Area */}
            <div className={`flex flex-col items-center justify-center transition-all duration-500 bg-slate-50/40 shrink-0 ${hasSearched ? 'py-6 border-b border-slate-100' : 'flex-1 py-16'}`}>
                <div className="w-full max-w-2xl px-6 text-center">
                    {!hasSearched && (
                        <div className="mb-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="mx-auto w-16 h-16 bg-pink-50 text-pink-600 rounded-3xl flex items-center justify-center shadow-inner mb-4">
                                <Search className="w-8 h-8" />
                            </div>
                            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Qual medicamento você procura?</h2>
                            <p className="text-xs text-slate-500 mt-1 font-semibold">Digite o nome ou lote do medicamento para verificar a disponibilidade de estoque.</p>
                        </div>
                    )}
                    
                    <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-3 items-stretch w-full">
                        <div className="relative flex-1">
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="Digite o nome do medicamento (Ex: Paracetamol, Amoxicilina...)"
                                className="w-full bg-white border border-slate-200/90 rounded-2xl pl-12 pr-12 py-4 text-sm font-bold focus:bg-white focus:border-pink-500 focus:ring-4 focus:ring-pink-500/10 outline-none transition-all text-slate-900 placeholder:text-slate-400 shadow-sm uppercase"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                            />
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={handleClearSearch}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black uppercase text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-lg"
                                >
                                    Limpar
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            </div>

            {/* Results Area */}
            <div className="flex-1 overflow-auto bg-slate-50/20 p-6 min-h-0">
                {loading ? (
                    <div className="h-full w-full flex flex-col items-center justify-center gap-2">
                        <div className="w-8 h-8 rounded-full border-4 border-pink-100 border-t-pink-500 animate-spin"></div>
                        <span className="text-xs font-bold text-slate-500 mt-2">Carregando medicamentos...</span>
                    </div>
                ) : !hasSearched ? null : searchResults.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 animate-in fade-in duration-300">
                        {searchResults.map(result => {
                            // Determine overall limit minimum as average or max of lotes
                            const limitMin = result.lotes[0]?.limite_minimo || 10;
                            const status = getStockStatus(result.quantidadeTotal, limitMin);
                            const progressPct = result.quantidadeTotal === 0 ? 0 : Math.min(100, (result.quantidadeTotal / (limitMin * 3)) * 100);

                            return (
                                <div
                                    key={result.nome}
                                    className="bg-white border border-slate-200/60 rounded-3xl p-6 hover:shadow-2xl hover:shadow-slate-150/40 hover:-translate-y-1 hover:border-pink-200 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden"
                                >
                                    {/* Subtle background card details */}
                                    <div className="absolute top-0 right-0 w-24 h-24 bg-slate-50 rounded-bl-full -z-10 group-hover:bg-pink-50/20 transition-colors duration-300"></div>

                                    <div className="flex-1 flex flex-col">
                                        {/* Status & Category row */}
                                        <div className="flex items-start justify-between gap-2 mb-5">
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider border shadow-sm ${status.colorClass}`}>
                                                {status.icon}
                                                {status.label}
                                            </span>
                                            
                                            <div className="flex flex-wrap gap-1.5 justify-end max-w-[60%]">
                                                {result.dosagem && (
                                                    <span className="text-[8px] font-black uppercase tracking-wider bg-pink-50 text-pink-600 border border-pink-100/30 px-2 py-1 rounded-lg shadow-sm">
                                                        {result.dosagem}
                                                    </span>
                                                )}
                                                {result.lotes[0]?.tipo && (
                                                    <span className="text-[8px] font-black uppercase tracking-wider bg-slate-50 text-slate-500 border border-slate-100/55 px-2 py-1 rounded-lg shadow-sm">
                                                        {result.lotes[0].tipo}
                                                    </span>
                                                )}
                                                <span className="text-[8px] font-black uppercase tracking-wider bg-slate-50 text-slate-400 border border-slate-100/55 px-2 py-1 rounded-lg shadow-sm">
                                                    {result.categoria}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Medicine Name */}
                                        <h4 className="font-extrabold text-slate-800 text-lg leading-snug uppercase mb-1 tracking-tight flex items-baseline gap-1.5 flex-wrap group-hover:text-pink-600 transition-colors">
                                            {result.nome}
                                            {result.dosagem && (
                                                <span className="text-pink-600 font-black text-lg ml-1">
                                                    {result.dosagem}
                                                </span>
                                            )}
                                        </h4>
                                        {result.lotes[0]?.principio_ativo && (
                                            <div className="text-[10px] text-slate-500 font-bold uppercase mb-4 tracking-wider flex items-center gap-1">
                                                <span className="text-slate-400">P. Ativo:</span> {result.lotes[0].principio_ativo}
                                            </div>
                                        )}
                                        
                                        {/* Lotes list breakdown */}
                                        <div className="border-t border-slate-100/60 pt-4 mt-1 flex-1 flex flex-col">
                                            <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block mb-2.5">Lotes em Estoque</span>
                                            <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1 custom-scrollbar">
                                                {result.lotes.map(lote => {
                                                    const isLoteExpired = new Date(lote.validade).getTime() <= Date.now();
                                                    const isLoteEmpty = lote.quantidade === 0;
                                                    
                                                    // Left accent border class
                                                    const borderClass = isLoteExpired 
                                                        ? 'border-l-4 border-l-rose-500' 
                                                        : isLoteEmpty 
                                                        ? 'border-l-4 border-l-slate-300' 
                                                        : lote.quantidade <= limitMin 
                                                        ? 'border-l-4 border-l-amber-500' 
                                                        : 'border-l-4 border-l-emerald-500';

                                                    return (
                                                        <div 
                                                            key={lote.id} 
                                                            className={`flex items-center justify-between text-[10px] font-semibold bg-slate-50/50 p-2.5 rounded-xl border border-slate-100/80 transition-all hover:bg-slate-50 ${borderClass} shadow-sm`}
                                                        >
                                                            <div className="space-y-0.5">
                                                                <span className="text-slate-800 font-extrabold block">Lote: {lote.lote}</span>
                                                                <span className={`text-[9px] font-medium inline-flex items-center gap-1 ${isLoteExpired ? 'text-rose-500 font-bold' : 'text-slate-400'}`}>
                                                                    Val: {formatDateBr(lote.validade)} 
                                                                    {isLoteExpired && (
                                                                        <span className="inline-block px-1 py-0.2 text-[7px] font-black bg-rose-50 text-rose-600 border border-rose-100 rounded-md animate-pulse">VENCIDO</span>
                                                                    )}
                                                                </span>
                                                            </div>
                                                            <div className="text-right">
                                                                <span className={`font-black text-xs ${isLoteEmpty ? 'text-rose-600' : lote.quantidade <= limitMin ? 'text-amber-600' : 'text-slate-800'}`}>
                                                                    {lote.quantidade}
                                                                </span>
                                                                <span className="text-[9px] text-slate-400 font-bold ml-1">{lote.unidade}</span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Total Quantity & Stock level bar */}
                                    <div className="border-t border-slate-100/60 pt-4 mt-5 flex flex-col shrink-0 gap-2">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider">Total Disponível</span>
                                            <div className="text-right flex items-baseline">
                                                <span className={`text-2xl font-black ${result.quantidadeTotal === 0 ? 'text-rose-600' : result.quantidadeTotal <= limitMin ? 'text-amber-500' : 'text-slate-800'}`}>
                                                    {result.quantidadeTotal}
                                                </span>
                                                <span className="text-[10px] text-slate-400 font-extrabold ml-1">{result.unidade}</span>
                                            </div>
                                        </div>
                                        
                                        {/* Dynamic stock indicator bar */}
                                        <div className="space-y-1">
                                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden shadow-inner">
                                                <div 
                                                    className={`h-full rounded-full transition-all duration-500 ${
                                                        result.quantidadeTotal === 0 
                                                            ? 'bg-rose-500' 
                                                            : result.quantidadeTotal <= limitMin 
                                                            ? 'bg-amber-500' 
                                                            : 'bg-emerald-500'
                                                    }`} 
                                                    style={{ width: `${progressPct}%` }}
                                                ></div>
                                            </div>
                                            <div className="flex justify-between items-center text-[7.5px] font-black uppercase text-slate-400 tracking-wider">
                                                <span>Esgotado</span>
                                                <span>Limite Mínimo: {limitMin}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8">
                        <XCircle className="w-12 h-12 mb-3 opacity-25 text-rose-500" />
                        <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-tight">Nenhum medicamento encontrado</h4>
                        <p className="text-xs text-slate-500 mt-1 font-semibold text-center max-w-[280px]">Não encontramos nenhum medicamento disponível com o termo "{searchQuery}".</p>
                    </div>
                )}
            </div>
        </div>
    );
};
