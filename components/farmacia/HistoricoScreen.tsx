import React, { useState, useEffect } from 'react';
import { User, FarmaciaMovimentacao } from '../../types';
import { ArrowLeft, Search, Filter, Calendar, Info, RefreshCw, Loader2, ClipboardList } from 'lucide-react';
import * as db from '../../services/farmaciaService';

interface HistoricoScreenProps {
    currentUser?: User | null;
    onBack: () => void;
}

export const HistoricoScreen: React.FC<HistoricoScreenProps> = ({
    currentUser,
    onBack
}) => {
    const [movements, setMovements] = useState<FarmaciaMovimentacao[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [filterName, setFilterName] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterPatient, setFilterPatient] = useState('');
    const [filterDateInicio, setFilterDateInicio] = useState('');
    const [filterDateFim, setFilterDateFim] = useState('');
    const [filterType, setFilterType] = useState('');
    const [filterResponsible, setFilterResponsible] = useState('');

    const loadMovements = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            // Fetch filtered movements
            const data = await db.getMovimentacoes({
                medicamentoNome: filterName || undefined,
                categoria: filterCategory || undefined,
                pacienteNome: filterPatient || undefined,
                dataInicio: filterDateInicio || undefined,
                dataFim: filterDateFim || undefined,
                responsavelNome: filterResponsible || undefined,
                tipo: filterType || undefined
            });
            setMovements(data);
        } catch (error) {
            console.error('Error fetching movements:', error);
        } finally {
            setLoading(false);
        }
    };

    // Load on mount and on filter changes
    useEffect(() => {
        loadMovements();
    }, [filterCategory, filterType, filterDateInicio, filterDateFim]);

    // Debounce manual text search filters
    useEffect(() => {
        const delay = setTimeout(() => {
            loadMovements(true);
        }, 400);
        return () => clearTimeout(delay);
    }, [filterName, filterPatient, filterResponsible]);

    // Realtime changes listener
    useEffect(() => {
        const handleRealtimeChange = () => {
            loadMovements(true);
        };
        window.addEventListener('farmacia-movimentacoes-changed', handleRealtimeChange);
        return () => {
            window.removeEventListener('farmacia-movimentacoes-changed', handleRealtimeChange);
        };
    }, [filterName, filterCategory, filterPatient, filterDateInicio, filterDateFim, filterType, filterResponsible]);

    const formatDateBr = (dateStr: string) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        const hrs = String(d.getHours()).padStart(2, '0');
        const mins = String(d.getMinutes()).padStart(2, '0');
        return `${day}/${month}/${year} ${hrs}:${mins}`;
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'Entrada':
                return 'bg-emerald-50 text-emerald-700 border-emerald-100';
            case 'Saída':
                return 'bg-pink-50 text-pink-700 border-pink-100';
            case 'Ajuste':
                return 'bg-amber-50 text-amber-700 border-amber-100';
            default:
                return 'bg-slate-50 text-slate-700 border-slate-100';
        }
    };

    return (
        <div className="w-full mx-auto flex flex-col flex-1 h-full max-h-full min-h-0 bg-white rounded-3xl border border-slate-200/80 shadow-xl overflow-hidden">
            {/* Header */}
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
                            Histórico de Movimentações
                            <span className="flex h-2 w-2 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-500"></span>
                            </span>
                        </h3>
                        <p className="text-xs text-slate-500 font-medium">Logs cronológicos de entradas, dispensações e ajustes de estoque</p>
                    </div>
                </div>
                <button
                    onClick={() => loadMovements(false)}
                    className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-all"
                    title="Atualizar dados"
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>

            {/* Advanced Filters Grid */}
            <div className="p-4 bg-slate-50 border-b border-slate-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 shrink-0">
                <div>
                    <input
                        type="text"
                        placeholder="Medicamento..."
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-pink-500 text-slate-900 placeholder:text-slate-400 uppercase"
                        value={filterName}
                        onChange={(e) => setFilterName(e.target.value.toUpperCase())}
                    />
                </div>
                <div>
                    <select
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-pink-500 text-slate-900 cursor-pointer"
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                    >
                        <option value="">Todas Categorias</option>
                        <option value="CBAF">CBAF</option>
                        <option value="CESAF">CESAF</option>
                        <option value="CEAF">CEAF</option>
                    </select>
                </div>
                <div>
                    <input
                        type="text"
                        placeholder="Paciente..."
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-pink-500 text-slate-900 placeholder:text-slate-400 uppercase"
                        value={filterPatient}
                        onChange={(e) => setFilterPatient(e.target.value.toUpperCase())}
                    />
                </div>
                <div>
                    <select
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-pink-500 text-slate-900 cursor-pointer"
                        value={filterType}
                        onChange={(e) => setFilterType(e.target.value)}
                    >
                        <option value="">Todos os Tipos</option>
                        <option value="Entrada">Entradas</option>
                        <option value="Saída">Saídas (Dispensações)</option>
                        <option value="Ajuste">Ajustes Manuais</option>
                    </select>
                </div>
                <div>
                    <input
                        type="text"
                        placeholder="Operador/Resp..."
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none focus:border-pink-500 text-slate-900 placeholder:text-slate-400"
                        value={filterResponsible}
                        onChange={(e) => setFilterResponsible(e.target.value)}
                    />
                </div>
                <div>
                    <input
                        type="date"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-pink-500 text-slate-900"
                        value={filterDateInicio}
                        onChange={(e) => setFilterDateInicio(e.target.value)}
                        placeholder="Início"
                        title="Data Início"
                    />
                </div>
                <div>
                    <input
                        type="date"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-pink-500 text-slate-900"
                        value={filterDateFim}
                        onChange={(e) => setFilterDateFim(e.target.value)}
                        placeholder="Fim"
                        title="Data Fim"
                    />
                </div>
            </div>

            {/* Logs Area */}
            <div className="flex-1 overflow-auto bg-slate-50/20 p-6 min-h-0">
                {loading ? (
                    <div className="h-full w-full flex flex-col items-center justify-center gap-2">
                        <Loader2 className="w-8 h-8 text-pink-600 animate-spin" />
                        <span className="text-xs font-bold text-slate-500">Buscando histórico...</span>
                    </div>
                ) : movements.length > 0 ? (
                    <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                        <th className="p-4">Data/Hora</th>
                                        <th className="p-4 text-center">Operação</th>
                                        <th className="p-4">Medicamento / Categoria</th>
                                        <th className="p-4">Lote / Validade</th>
                                        <th className="p-4 text-center">Quantidade</th>
                                        <th className="p-4">Paciente</th>
                                        <th className="p-4">Responsável</th>
                                        <th className="p-4">Observações / Motivo</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                                    {movements.map((mov) => (
                                        <tr key={mov.id} className="hover:bg-slate-50/30 transition-colors">
                                            <td className="p-4 text-slate-500 font-mono">
                                                {formatDateBr(mov.data)}
                                            </td>
                                            <td className="p-4 text-center">
                                                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border ${getTypeColor(mov.tipo)}`}>
                                                    {mov.tipo}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <div className="font-extrabold text-slate-900 uppercase">{mov.medicamento_nome}</div>
                                                <div className="flex flex-wrap gap-1 mt-1">
                                                    <span className="inline-block px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded bg-pink-50 text-pink-600">
                                                        {mov.medicamento_categoria}
                                                    </span>
                                                    {mov.medicamento_dosagem && (
                                                        <span className="inline-block px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded bg-pink-50 text-pink-700 border border-pink-100">
                                                            {mov.medicamento_dosagem}
                                                        </span>
                                                    )}
                                                    {mov.medicamento_tipo && (
                                                        <span className="inline-block px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider rounded bg-slate-100 text-slate-500">
                                                            {mov.medicamento_tipo}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="font-mono text-slate-600 font-bold">Lote: {mov.lote}</div>
                                                <div className="text-[10px] text-slate-400 mt-0.5 font-bold">
                                                    Val: {mov.validade.split('-').reverse().join('/')}
                                                </div>
                                            </td>
                                            <td className="p-4 text-center text-slate-900 font-black">
                                                {mov.quantidade}
                                            </td>
                                            <td className="p-4">
                                                {mov.paciente_nome ? (
                                                    <>
                                                        <div className="font-bold text-slate-800 uppercase">{mov.paciente_nome}</div>
                                                        <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                                                            CPF: {mov.paciente_cpf?.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}
                                                        </div>
                                                    </>
                                                ) : (
                                                    <span className="text-slate-300">-</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-slate-500 font-bold">
                                                {mov.responsavel_nome}
                                            </td>
                                            <td className="p-4 text-slate-400 italic max-w-xs truncate" title={mov.observacoes || ''}>
                                                {mov.observacoes || '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 p-8">
                        <ClipboardList className="w-12 h-12 mb-3 opacity-25 text-slate-500" />
                        <h4 className="text-sm font-extrabold text-slate-800">Nenhum registro encontrado</h4>
                        <p className="text-xs text-slate-500 mt-1 font-medium text-center">Nenhum log corresponde aos filtros informados.</p>
                    </div>
                )}
            </div>
        </div>
    );
};
