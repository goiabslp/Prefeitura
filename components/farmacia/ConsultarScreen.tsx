import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, FarmaciaMedicamento } from '../../types';
import { ArrowLeft, Search, AlertTriangle, CheckCircle2, XCircle, Info, RefreshCw } from 'lucide-react';
import * as db from '../../services/farmaciaService';

interface ConsultarScreenProps {
    currentUser?: User | null;
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

    // Função utilitária para normalizar texto (sem acentos, minúsculo)
    const normalizeText = (text: string | undefined | null): string => {
        if (!text) return '';
        return text
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
    };

    const trimmedQuery = searchQuery.trim();
    const hasMinChars = trimmedQuery.length >= 3;
    const hasSearched = hasMinChars;

    // Group matching lotes by medicine name dynamically in real-time
    const searchResults = useMemo(() => {
        if (!hasMinChars) return [];
        const term = normalizeText(trimmedQuery);
        if (!term) return [];

        // Filtra medicamentos matching query (início do nome ou princípio ativo)
        const matched = medicamentos.filter(med => {
            // Não deve retornar medicamentos inativos ou com estoque zerado
            if (med.quantidade === 0) return false;

            const matchAtStart = (str: string | undefined | null) => {
                if (!str) return false;
                const normalizedStr = normalizeText(str);
                return normalizedStr.startsWith(term);
            };

            return matchAtStart(med.nome) || 
                   matchAtStart(med.principio_ativo);
        });

        // Group by name and dosage (case insensitive key)
        const groups: Record<string, {
            nome: string;
            dosagem?: string;
            categoria: string;
            principio_ativo?: string;
            tipo?: string;
            alto_custo?: boolean;
            quantidadeTotal: number;
            unidade: string;
            limite_minimo: number;
            lotes: FarmaciaMedicamento[];
        }> = {};

        matched.forEach(med => {
            const nameKey = `${med.nome.toUpperCase()}::${(med.dosagem || '').toUpperCase()}`;
            if (!groups[nameKey]) {
                groups[nameKey] = {
                    nome: med.nome,
                    dosagem: med.dosagem,
                    categoria: med.categoria,
                    principio_ativo: med.principio_ativo,
                    tipo: med.tipo,
                    alto_custo: med.alto_custo,
                    quantidadeTotal: 0,
                    unidade: med.unidade,
                    limite_minimo: med.limite_minimo || 10,
                    lotes: []
                };
            }
            groups[nameKey].quantidadeTotal += med.quantidade;
            groups[nameKey].lotes.push(med);
        });

        // Ordenação dos lotes por validade mais próxima (FEFO)
        Object.values(groups).forEach(g => {
            g.lotes.sort((a, b) => new Date(a.validade).getTime() - new Date(b.validade).getTime());
        });

        return Object.values(groups);
    }, [medicamentos, trimmedQuery, hasMinChars]);

    const getStockStatus = (quantidade: number, limiteMinimo: number) => {
        if (quantidade === 0) {
            return {
                label: 'Indisponível',
                colorClass: 'bg-rose-50 text-rose-700 border-rose-200/80',
                dotColor: 'bg-rose-500',
                textColor: 'text-rose-600',
                barGradient: 'from-rose-500 to-rose-600',
                borderAccent: 'border-t-rose-500',
                icon: <XCircle className="w-3.5 h-3.5" />
            };
        }
        if (quantidade <= limiteMinimo) {
            return {
                label: 'Baixo Estoque',
                colorClass: 'bg-amber-50 text-amber-700 border-amber-200/80',
                dotColor: 'bg-amber-500',
                textColor: 'text-amber-600',
                barGradient: 'from-amber-400 to-amber-500',
                borderAccent: 'border-t-amber-500',
                icon: <AlertTriangle className="w-3.5 h-3.5" />
            };
        }
        return {
            label: 'Disponível',
            colorClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
            dotColor: 'bg-emerald-500',
            textColor: 'text-emerald-700',
            barGradient: 'from-emerald-400 to-emerald-500',
            borderAccent: 'border-t-emerald-500',
            icon: <CheckCircle2 className="w-3.5 h-3.5" />
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
            <div className="px-6 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="p-2 -ml-2 text-slate-400 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-all"
                        title="Voltar"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h3 className="font-extrabold text-slate-900 tracking-tight text-base sm:text-lg flex items-center gap-2">
                            Consultar Medicamentos
                            <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-500"></span>
                            </span>
                        </h3>
                        <p className="text-[11px] sm:text-xs text-slate-500 font-medium">Consulte disponibilidade e quantidade em tempo real</p>
                    </div>
                </div>
                <button
                    onClick={() => loadMedicamentos(true)}
                    className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-all cursor-pointer"
                    title="Atualizar dados"
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            {/* Central Search Area */}
            <div className={`flex flex-col items-center justify-center transition-all duration-300 bg-slate-50/40 shrink-0 ${hasSearched ? 'py-3.5 sm:py-4 border-b border-slate-100' : 'flex-1 py-14'}`}>
                <div className="w-full max-w-2xl px-6 text-center">
                    {!hasSearched && trimmedQuery.length === 0 && (
                        <div className="mb-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="mx-auto w-14 h-14 bg-pink-50 text-pink-600 rounded-2xl flex items-center justify-center shadow-inner mb-3">
                                <Search className="w-7 h-7" />
                            </div>
                            <h2 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight">Qual medicamento você procura?</h2>
                            <p className="text-xs text-slate-500 mt-1 font-semibold max-w-md mx-auto">Digite as iniciais do medicamento ou princípio ativo (mínimo de 3 letras) para verificar a disponibilidade.</p>
                        </div>
                    )}
                    
                    <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2.5 items-stretch w-full">
                        <div className="relative flex-1">
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="Digite o nome ou princípio ativo (Ex: DIP, AMO, PAR...)"
                                className="w-full bg-white border border-slate-200/90 rounded-2xl pl-11 pr-12 py-3 text-xs sm:text-sm font-bold focus:bg-white focus:border-pink-500 focus:ring-4 focus:ring-pink-500/10 outline-none transition-all text-slate-900 placeholder:text-slate-400 shadow-xs uppercase"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value.toUpperCase())}
                            />
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={handleClearSearch}
                                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[10px] font-black uppercase text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-md cursor-pointer transition-colors"
                                >
                                    Limpar
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            </div>

            {/* Results Area */}
            <div className="flex-1 overflow-auto bg-slate-50/30 p-4 sm:p-5 min-h-0 custom-scrollbar">
                {loading ? (
                    <div className="h-full w-full flex flex-col items-center justify-center gap-2">
                        <div className="w-8 h-8 rounded-full border-4 border-pink-100 border-t-pink-500 animate-spin"></div>
                        <span className="text-xs font-bold text-slate-500 mt-2">Carregando medicamentos...</span>
                    </div>
                ) : trimmedQuery.length > 0 && !hasMinChars ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 animate-in fade-in duration-200">
                        <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-3 border border-amber-200/60 shadow-xs">
                            <Info className="w-6 h-6" />
                        </div>
                        <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-tight">Digite no mínimo 3 caracteres</h4>
                        <p className="text-xs text-slate-500 mt-1 font-semibold text-center max-w-[320px]">
                            A busca por iniciais só é realizada com 3 letras ou mais para garantir resultados precisos.
                        </p>
                        <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 rounded-full border border-amber-200 text-[11px] font-black tracking-wider uppercase">
                            Falta {3 - trimmedQuery.length} caractere{3 - trimmedQuery.length > 1 ? 's' : ''} para iniciar a pesquisa
                        </div>
                    </div>
                ) : !hasSearched ? null : searchResults.length > 0 ? (
                    <div className="space-y-3 animate-in fade-in duration-300">
                        {/* Summary Header */}
                        <div className="flex items-center justify-between px-1 text-xs text-slate-500 font-semibold">
                            <span>
                                Encontrado(s) <strong className="text-slate-800 font-bold">{searchResults.length}</strong> medicamento(s)
                            </span>
                            <span className="text-[11px] text-slate-400">Ordenado por disponibilidade e validade</span>
                        </div>

                        {/* Cards Grid: Compacto, Moderno e Responsivo */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3.5">
                            {searchResults.map(result => {
                                const limitMin = result.limite_minimo || 10;
                                const status = getStockStatus(result.quantidadeTotal, limitMin);
                                const progressPct = result.quantidadeTotal === 0 ? 0 : Math.min(100, (result.quantidadeTotal / (limitMin * 3)) * 100);

                                return (
                                    <div
                                        key={`${result.nome}::${result.dosagem || ''}`}
                                        className={`bg-white rounded-2xl border border-slate-200/80 hover:border-pink-300 shadow-xs hover:shadow-[0_12px_28px_rgba(236,72,153,0.08)] hover:-translate-y-0.5 active:scale-[0.99] transition-all duration-200 flex flex-col justify-between group relative overflow-hidden p-3.5 sm:p-4 border-t-[3px] ${status.borderAccent}`}
                                    >
                                        {/* Detalhe de fundo suave no hover */}
                                        <div className="absolute top-0 right-0 w-24 h-24 bg-pink-50/20 rounded-bl-full pointer-events-none group-hover:scale-125 transition-transform"></div>

                                        <div className="flex-1 flex flex-col">
                                            {/* Cabeçalho do Card: Status + Categoria */}
                                            <div className="flex items-center justify-between gap-1.5 mb-2">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider border shadow-2xs ${status.colorClass}`}>
                                                    <span className={`w-1.5 h-1.5 rounded-full ${status.dotColor} animate-pulse shrink-0`}></span>
                                                    {status.label}
                                                </span>

                                                <div className="flex items-center gap-1 shrink-0">
                                                    {result.categoria && (
                                                        <span className="text-[8.5px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200/60 px-1.5 py-0.5 rounded-md">
                                                            {result.categoria}
                                                        </span>
                                                    )}
                                                    {result.tipo && (
                                                        <span className="text-[8.5px] font-bold text-slate-500 bg-slate-50 border border-slate-200/50 px-1.5 py-0.5 rounded-md hidden xs:inline-block">
                                                            {result.tipo}
                                                        </span>
                                                    )}
                                                    {result.alto_custo && (
                                                        <span className="text-[8px] font-black uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 px-1 py-0.5 rounded-md">
                                                            Alto Custo
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Nome do Medicamento + Dosagem */}
                                            <div className="mb-2">
                                                <h4 className="font-black text-slate-800 text-[13px] sm:text-sm leading-snug uppercase tracking-tight group-hover:text-pink-600 transition-colors">
                                                    {result.nome}
                                                    {result.dosagem && (
                                                        <span className="inline-flex items-center ml-1.5 px-1.5 py-0.2 rounded-md text-[9.5px] font-black bg-pink-50 text-pink-600 border border-pink-200/70 align-middle">
                                                            {result.dosagem}
                                                        </span>
                                                    )}
                                                </h4>
                                                {result.principio_ativo && (
                                                    <p className="text-[9.5px] text-slate-400 font-medium truncate mt-0.5" title={result.principio_ativo}>
                                                        <span className="text-slate-500 font-bold uppercase text-[8.5px]">P. Ativo:</span> {result.principio_ativo}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Bloco Compacto de Estoque Total */}
                                            <div className="bg-slate-50/90 rounded-xl p-2.5 border border-slate-150/80 mb-2.5 flex items-center justify-between">
                                                <div>
                                                    <span className="text-[8.5px] font-bold uppercase tracking-wider text-slate-400 block leading-none">Total Disponível</span>
                                                    <div className="flex items-baseline gap-1 mt-1">
                                                        <span className={`text-xl sm:text-2xl font-black font-mono leading-none ${result.quantidadeTotal === 0 ? 'text-rose-600' : result.quantidadeTotal <= limitMin ? 'text-amber-500' : 'text-slate-900'}`}>
                                                            {result.quantidadeTotal}
                                                        </span>
                                                        <span className="text-[9.5px] font-extrabold text-slate-400 uppercase">{result.unidade}</span>
                                                    </div>
                                                </div>

                                                <div className="flex flex-col items-end gap-1">
                                                    <div className="flex items-center gap-1 text-[8.5px] font-bold text-slate-400">
                                                        <span>Mínimo:</span>
                                                        <strong className="text-slate-600 font-mono">{limitMin}</strong>
                                                    </div>
                                                    {/* Barra de Progresso Dinâmica */}
                                                    <div className="w-20 sm:w-24 bg-slate-200/70 h-1.5 rounded-full overflow-hidden shadow-inner">
                                                        <div
                                                            className={`h-full rounded-full bg-gradient-to-r ${status.barGradient} transition-all duration-500`}
                                                            style={{ width: `${progressPct}%` }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Lista Compacta de Lotes */}
                                            <div className="flex-1 flex flex-col pt-0.5">
                                                <div className="flex items-center justify-between text-[8.5px] font-extrabold uppercase tracking-wider text-slate-400 mb-1 px-0.5">
                                                    <span className="flex items-center gap-1">
                                                        <span>Lotes</span>
                                                        <span className="px-1.5 py-0.2 bg-slate-100 text-slate-500 rounded-full font-mono text-[8px] font-black">
                                                            {result.lotes.length}
                                                        </span>
                                                    </span>
                                                    <span>Validade & Qtd</span>
                                                </div>

                                                <div className="space-y-1 max-h-[95px] overflow-y-auto pr-0.5 custom-scrollbar">
                                                    {result.lotes.map(lote => {
                                                        const isLoteExpired = new Date(lote.validade).getTime() <= Date.now();
                                                        const isLoteEmpty = lote.quantidade === 0;
                                                        const isLow = lote.quantidade <= limitMin;

                                                        return (
                                                            <div
                                                                key={lote.id}
                                                                className={`flex items-center justify-between py-1 px-2 rounded-lg border text-[9.5px] transition-all ${
                                                                    isLoteExpired
                                                                        ? 'bg-rose-50/50 border-rose-200/80 text-rose-800'
                                                                        : isLoteEmpty
                                                                        ? 'bg-slate-50 border-slate-200 text-slate-400'
                                                                        : 'bg-white border-slate-200/70 text-slate-700 hover:bg-slate-50/80'
                                                                }`}
                                                            >
                                                                <div className="flex items-center gap-1.5 min-w-0">
                                                                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                                                        isLoteExpired ? 'bg-rose-500 animate-pulse' : isLoteEmpty ? 'bg-slate-300' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
                                                                    }`}></span>
                                                                    <span className="font-mono font-bold text-[10px] truncate max-w-[100px]" title={lote.lote}>
                                                                        {lote.lote}
                                                                    </span>
                                                                </div>

                                                                <div className="flex items-center gap-2 shrink-0">
                                                                    <span className={`text-[9px] font-medium ${isLoteExpired ? 'text-rose-600 font-bold' : 'text-slate-400'}`}>
                                                                        {formatDateBr(lote.validade)}
                                                                        {isLoteExpired && (
                                                                            <span className="ml-1 text-[7.5px] font-black bg-rose-100 text-rose-700 px-1 py-0.2 rounded">VENC</span>
                                                                        )}
                                                                    </span>
                                                                    <span className={`font-mono text-[10px] font-black px-1.5 py-0.2 rounded ${
                                                                        isLoteEmpty ? 'text-slate-400' : 'bg-slate-100 text-slate-900 border border-slate-200/50'
                                                                    }`}>
                                                                        {lote.quantidade} <span className="text-[7.5px] font-bold text-slate-400">{lote.unidade}</span>
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8 animate-in fade-in duration-200">
                        <XCircle className="w-12 h-12 mb-3 opacity-25 text-rose-500" />
                        <h4 className="text-sm font-extrabold text-slate-800 uppercase tracking-tight">Nenhum medicamento encontrado</h4>
                        <p className="text-xs text-slate-500 mt-1 font-semibold text-center max-w-[320px]">
                            Não encontramos nenhum medicamento disponível com as iniciais <strong className="text-slate-700 font-bold">"{trimmedQuery}"</strong> no nome ou princípio ativo.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
