import React, { useEffect, useState } from 'react';
import { CheckCircle2, FileText, Loader2, X } from 'lucide-react';
import * as counterService from '../../services/counterService';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (summary?: string) => void;
    sectorId: string | null;
    sectorName: string;
    title?: string;
    label?: string;
}

export const OficioNumberingModal: React.FC<Props> = ({ isOpen, onClose, onConfirm, sectorId, sectorName, title = "Gerando Número", label = "PRÓXIMO OFÍCIO DO SETOR" }) => {
    const [loading, setLoading] = useState(true);
    const [nextNumber, setNextNumber] = useState<number | null>(null);
    const [year, setYear] = useState<number>(new Date().getFullYear());

    const [summary, setSummary] = useState('');
    const [showError, setShowError] = useState(false);

    useEffect(() => {
        let isMounted = true;
        // Reset summary when opening
        if (isOpen) {
            setSummary('');
            setShowError(false);
        }

        if (isOpen && sectorId) {
            const fetchNext = async () => {
                setLoading(true);
                const start = Date.now();

                try {
                    const num = await counterService.getNextSectorCount(sectorId, new Date().getFullYear());
                    if (!isMounted) return;

                    const elapsed = Date.now() - start;
                    if (elapsed < 600) {
                        await new Promise(resolve => setTimeout(resolve, 600 - elapsed));
                    }

                    if (!isMounted) return;
                    setNextNumber(num);
                    setLoading(false);
                } catch (error) {
                    if (isMounted) setLoading(false);
                }
            };
            fetchNext();
        } else if (isOpen) {
            // Handle case where sectorId is missing
            setLoading(false);
            setNextNumber(null);
        }
        return () => { isMounted = false; };
    }, [isOpen, sectorId]);

    if (!isOpen) return null;

    const formattedNumber = nextNumber ? nextNumber.toString().padStart(3, '0') : '...';

    return (
        <div className="fixed inset-0 z-[2500] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xl animate-fade-in">
            <div className="w-full max-w-md bg-white rounded-[2rem] shadow-2xl border border-white/20 overflow-hidden flex flex-col animate-scale-in relative">

                {/* Header / Decor */}
                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-br from-indigo-500 to-purple-600 opacity-10 pointer-events-none" />

                <div className="p-8 text-center flex flex-col items-center relative z-10">
                    <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mb-6 shadow-2xl shadow-indigo-500/20 border-4 border-indigo-50">
                        {loading ? (
                            <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                        ) : (
                            <FileText className="w-8 h-8 text-indigo-600" />
                        )}
                    </div>

                    <h3 className="text-xl font-black text-slate-800 tracking-tight mb-2 uppercase">
                        {title}
                    </h3>

                    <div className="flex flex-col items-center justify-center py-6 w-full">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
                            {label}
                        </span>
                        <div className="text-5xl font-mono font-black text-slate-900 tracking-tighter flex items-end leading-none">
                            {loading ? (
                                <span className="animate-pulse text-slate-300">...</span>
                            ) : (
                                <>
                                    <span>{formattedNumber === '...' ? 'Aleatório' : formattedNumber}</span>
                                    <span className="text-2xl text-slate-400 mb-1">/{year}</span>
                                </>
                            )}
                        </div>
                        {sectorName && (
                            <span className="mt-3 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-bold uppercase tracking-wide">
                                {sectorName}
                            </span>
                        )}
                    </div>

                    <div className="w-full mb-6 text-left">
                        <label className={`text-[10px] font-bold uppercase tracking-widest mb-2 block pl-1 transition-colors ${showError ? 'text-rose-500' : 'text-slate-400'}`}>
                            Resumo do Pedido (Obrigatório)
                        </label>
                        <textarea
                            value={summary}
                            onChange={(e) => {
                                setSummary(e.target.value);
                                if (e.target.value.trim()) setShowError(false);
                            }}
                            placeholder="Descreva brevemente o assunto deste ofício..."
                            className={`w-full p-3 bg-slate-50 border rounded-xl text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-all resize-none h-20 ${showError
                                    ? 'border-rose-400 ring-2 ring-rose-500/10'
                                    : 'border-slate-200 focus:ring-indigo-500/20 focus:border-indigo-500'
                                }`}
                            maxLength={200}
                        />
                        {showError && (
                            <span className="text-[10px] font-bold text-rose-500 ml-1 mt-1 block animate-fade-in uppercase tracking-wider">
                                Por favor, preencha o resumo do pedido.
                            </span>
                        )}
                    </div>

                    <p className="text-slate-500 text-sm font-medium leading-relaxed mb-8 max-w-[280px]">
                        O sistema identificou o próximo número sequencial para o seu setor. Deseja confirmar e salvar o documento?
                    </p>

                    <div className="flex w-full gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3.5 text-slate-500 font-bold text-xs uppercase tracking-widest hover:bg-slate-50 hover:text-slate-700 rounded-xl transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={() => {
                                if (!summary.trim()) {
                                    setShowError(true);
                                    return;
                                }
                                onConfirm(summary);
                            }}
                            disabled={loading}
                            className="flex-1 py-3.5 bg-indigo-600 text-white font-bold text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-indigo-500/30 hover:bg-indigo-700 hover:shadow-indigo-600/40 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
                        >
                            {loading ? 'Calculando...' : (
                                <>
                                    <CheckCircle2 className="w-4 h-4" />
                                    Confirmar
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
