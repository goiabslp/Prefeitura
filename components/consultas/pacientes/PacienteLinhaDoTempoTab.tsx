import React, { useState } from 'react';
import { ItemLinhaDoTempo } from '../../../services/pacienteHistoricoService';
import { Calendar, Clock, Pill, CheckCircle2, AlertCircle, PauseCircle, PlayCircle, Stethoscope, FileText, ArrowRight, Activity, Filter } from 'lucide-react';

interface PacienteLinhaDoTempoTabProps {
    linhaDoTempo: ItemLinhaDoTempo[];
    periodoFiltro: string;
}

export const PacienteLinhaDoTempoTab: React.FC<PacienteLinhaDoTempoTabProps> = ({
    linhaDoTempo,
    periodoFiltro
}) => {
    const [filtroOrigem, setFiltroOrigem] = useState<string>('todos');
    const [modalDetalheItem, setModalDetalheItem] = useState<ItemLinhaDoTempo | null>(null);

    const itensFiltrados = linhaDoTempo.filter(item => {
        if (filtroOrigem !== 'todos') {
            if (filtroOrigem === 'regulacao' && item.origem !== 'Regulação') return false;
            if (filtroOrigem === 'consultas' && item.origem !== 'Consultas') return false;
            if (filtroOrigem === 'farmacia' && item.origem !== 'Farmácia Popular') return false;
        }
        return true;
    });

    const getIconeItem = (tipo: ItemLinhaDoTempo['tipo']) => {
        switch (tipo) {
            case 'solicitacao':
                return <Clock className="w-4 h-4 text-sky-600" />;
            case 'agendamento':
                return <Calendar className="w-4 h-4 text-indigo-600" />;
            case 'realizacao':
                return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
            case 'cancelamento':
                return <AlertCircle className="w-4 h-4 text-rose-600" />;
            case 'pausa':
                return <PauseCircle className="w-4 h-4 text-amber-600" />;
            case 'retomada':
                return <PlayCircle className="w-4 h-4 text-teal-600" />;
            case 'medicamento':
                return <Pill className="w-4 h-4 text-purple-600" />;
            default:
                return <Activity className="w-4 h-4 text-slate-600" />;
        }
    };

    const getBadgeStyle = (color: string) => {
        switch (color) {
            case 'sky':
                return 'bg-sky-50 text-sky-700 border-sky-200';
            case 'indigo':
                return 'bg-indigo-50 text-indigo-700 border-indigo-200';
            case 'emerald':
                return 'bg-emerald-50 text-emerald-700 border-emerald-200';
            case 'rose':
                return 'bg-rose-50 text-rose-700 border-rose-200';
            case 'amber':
                return 'bg-amber-50 text-amber-700 border-amber-200';
            case 'teal':
                return 'bg-teal-50 text-teal-700 border-teal-200';
            case 'purple':
                return 'bg-purple-50 text-purple-700 border-purple-200';
            default:
                return 'bg-slate-50 text-slate-700 border-slate-200';
        }
    };

    return (
        <div className="space-y-4">
            {/* Filtros da Linha do Tempo */}
            <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-2.5">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-500">Origem:</span>
                    <div className="flex items-center gap-1">
                        {[
                            { key: 'todos', label: 'Tudo' },
                            { key: 'regulacao', label: 'Regulação' },
                            { key: 'consultas', label: 'Consultas' },
                            { key: 'farmacia', label: 'Farmácia' }
                        ].map(opt => (
                            <button
                                key={opt.key}
                                type="button"
                                onClick={() => setFiltroOrigem(opt.key)}
                                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                    filtroOrigem === opt.key
                                        ? 'bg-slate-900 text-white shadow-xs'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                <span className="text-xs font-bold text-slate-500">
                    {itensFiltrados.length} evento(s) cronológico(s)
                </span>
            </div>

            {/* Linha do Tempo Vertical */}
            {itensFiltrados.length === 0 ? (
                <div className="bg-white rounded-3xl p-8 border border-slate-200/90 text-center space-y-2">
                    <Activity className="w-10 h-10 text-slate-300 mx-auto" />
                    <h4 className="text-sm font-black uppercase text-slate-700">Nenhuma movimentação registrada</h4>
                    <p className="text-xs text-slate-400">Não há registros na linha do tempo para os filtros selecionados.</p>
                </div>
            ) : (
                <div className="relative pl-6 sm:pl-8 space-y-4 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                    {itensFiltrados.map((item) => {
                        const dtFormatada = item.dataHora
                            ? new Date(item.dataHora).toLocaleDateString('pt-BR', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: 'numeric'
                              })
                            : '-';

                        const horaFormatada = item.dataHora && item.dataHora.includes('T')
                            ? new Date(item.dataHora).toLocaleTimeString('pt-BR', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                              })
                            : '';

                        return (
                            <div key={item.id} className="relative group">
                                {/* Ponto na linha */}
                                <div className="absolute -left-6 sm:-left-8 top-3.5 -translate-x-1/2 w-7 h-7 rounded-full bg-white border-2 border-slate-200 group-hover:border-sky-500 flex items-center justify-center shadow-xs transition-colors">
                                    {getIconeItem(item.tipo)}
                                </div>

                                {/* Card do Evento */}
                                <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/90 hover:border-sky-200 shadow-2xs hover:shadow-xs transition-all space-y-2">
                                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                                        <div className="flex items-center gap-2">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${getBadgeStyle(item.badgeColor)}`}>
                                                {item.badge}
                                            </span>
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">
                                                {item.origem}
                                            </span>
                                        </div>

                                        <span className="text-xs font-extrabold text-slate-600">
                                            {dtFormatada} {horaFormatada ? `às ${horaFormatada}` : ''}
                                        </span>
                                    </div>

                                    <div>
                                        <h4 className="text-sm font-black text-slate-900 leading-snug">
                                            {item.titulo}
                                        </h4>
                                        <p className="text-xs text-slate-600 font-medium mt-0.5">
                                            {item.subtitulo}
                                        </p>
                                    </div>

                                    {item.detalhes && (
                                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                                            <span className="truncate">{item.detalhes}</span>
                                            <button
                                                type="button"
                                                onClick={() => setModalDetalheItem(item)}
                                                className="text-sky-600 hover:text-sky-800 font-black flex items-center gap-1 shrink-0 cursor-pointer"
                                            >
                                                Detalhes <ArrowRight className="w-3 h-3" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal de Detalhes do Evento da Linha do Tempo */}
            {modalDetalheItem && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="bg-white rounded-3xl p-5 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-black uppercase border ${getBadgeStyle(modalDetalheItem.badgeColor)}`}>
                                {modalDetalheItem.origem} • {modalDetalheItem.badge}
                            </span>
                            <button
                                type="button"
                                onClick={() => setModalDetalheItem(null)}
                                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        <div>
                            <h3 className="text-base font-black text-slate-900">
                                {modalDetalheItem.titulo}
                            </h3>
                            <p className="text-xs text-slate-600 mt-1">
                                {modalDetalheItem.subtitulo}
                            </p>
                            {modalDetalheItem.detalhes && (
                                <p className="text-xs text-slate-500 mt-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                                    {modalDetalheItem.detalhes}
                                </p>
                            )}
                        </div>

                        <div className="text-[11px] text-slate-400 border-t pt-3 flex justify-between">
                            <span>Data e hora oficial:</span>
                            <strong className="text-slate-700">
                                {modalDetalheItem.dataHora ? new Date(modalDetalheItem.dataHora).toLocaleString('pt-BR') : '-'}
                            </strong>
                        </div>

                        <button
                            type="button"
                            onClick={() => setModalDetalheItem(null)}
                            className="w-full py-2.5 rounded-xl bg-slate-900 text-white font-black text-xs uppercase cursor-pointer"
                        >
                            Fechar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
