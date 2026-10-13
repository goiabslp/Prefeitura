import React, { useState, useMemo } from 'react';
import { FarmaciaMovimentacao } from '../../../types';
import { IndicadoresPaciente } from '../../../services/pacienteHistoricoService';
import { Pill, Calendar, Search, UserCheck, Stethoscope, Hash, Package, AlertCircle, Info, ChevronDown, ChevronUp } from 'lucide-react';

interface PacienteMedicamentosTabProps {
    medicamentos: FarmaciaMovimentacao[];
    indicadores: IndicadoresPaciente;
    periodoFiltro: string;
}

export const PacienteMedicamentosTab: React.FC<PacienteMedicamentosTabProps> = ({
    medicamentos,
    indicadores,
    periodoFiltro
}) => {
    const [filtroTexto, setFiltroTexto] = useState('');
    const [expandedMedId, setExpandedMedId] = useState<string | null>(null);

    // Medicamentos filtrados por busca textual
    const medicamentosFiltrados = useMemo(() => {
        if (!filtroTexto.trim()) return medicamentos;
        const search = filtroTexto.toLowerCase().trim();
        return medicamentos.filter(m => {
            const nome = (m.medicamento_nome || '').toLowerCase();
            const lote = (m.lote || '').toLowerCase();
            const medico = (m.medico_nome || '').toLowerCase();
            const crm = (m.medico_crm || '').toLowerCase();
            return nome.includes(search) || lote.includes(search) || medico.includes(search) || crm.includes(search);
        });
    }, [medicamentos, filtroTexto]);

    return (
        <div className="space-y-4">
            {/* Cards de Métricas da Farmácia */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
                <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/90 shadow-2xs">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                        Total de Retiradas
                    </span>
                    <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-xl sm:text-2xl font-black text-slate-900">
                            {indicadores.totalRetiradasMedicamentos}
                        </span>
                        <span className="text-xs text-slate-400 font-bold">operações</span>
                    </div>
                    <span className="text-[10px] text-purple-600 font-bold block mt-0.5">
                        Registros oficiais de saída
                    </span>
                </div>

                <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/90 shadow-2xs">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                        Medicamentos Distintos
                    </span>
                    <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-xl sm:text-2xl font-black text-purple-700">
                            {indicadores.totalMedicamentosDiferentes}
                        </span>
                        <span className="text-xs text-slate-400 font-bold">itens</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
                        Diferentes fármacos retirados
                    </span>
                </div>

                <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/90 shadow-2xs">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                        Quantidade Física Entregue
                    </span>
                    <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-xl sm:text-2xl font-black text-slate-900">
                            {indicadores.totalQuantidadeFisicaEntregue}
                        </span>
                        <span className="text-xs text-slate-400 font-bold">unidades</span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
                        Comprimidos / frascos
                    </span>
                </div>

                <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/90 shadow-2xs">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                        Última Retirada
                    </span>
                    <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-sm sm:text-base font-black text-slate-900 truncate">
                            {indicadores.dataUltimaMovimentacao
                                ? new Date(indicadores.dataUltimaMovimentacao).toLocaleDateString('pt-BR')
                                : 'Sem registro'}
                        </span>
                    </div>
                    <span className="text-[10px] text-slate-500 font-medium block mt-0.5">
                        Data do último atendimento
                    </span>
                </div>
            </div>

            {/* Aviso Técnico / LGPD / Uso Clínico */}
            <div className="bg-purple-50/70 border border-purple-200/80 rounded-2xl p-3 flex items-start gap-2.5 text-xs text-purple-900">
                <Info className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                    <strong>Nota administrativa:</strong> O histórico de dispensação reflete exclusivamente as entregas físicas registradas no balcão da Farmácia Popular. Não presume uso contínuo, adesão ao tratamento ou consumo efetivo sem avaliação médica ou farmacêutica direta.
                </p>
            </div>

            {/* Barra de Busca de Medicamentos */}
            <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <div className="relative flex-1">
                    <input
                        type="text"
                        placeholder="Buscar por medicamento, lote, médico prescritor ou CRM..."
                        value={filtroTexto}
                        onChange={(e) => setFiltroTexto(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-500/10 transition-all"
                    />
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
                <div className="text-xs font-bold text-slate-500 text-right">
                    {medicamentosFiltrados.length} dispensação(ões) encontrada(s)
                </div>
            </div>

            {/* Lista de Medicamentos Dispensados */}
            {medicamentosFiltrados.length === 0 ? (
                <div className="bg-white rounded-3xl p-8 border border-slate-200/90 text-center space-y-2">
                    <Pill className="w-10 h-10 text-slate-300 mx-auto" />
                    <h4 className="text-sm font-black uppercase text-slate-700">Nenhum medicamento registrado</h4>
                    <p className="text-xs text-slate-400">Não há registros de retiradas na Farmácia Popular para este paciente ou filtro selecionado.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {medicamentosFiltrados.map((med) => {
                        const isExpanded = expandedMedId === med.id;
                        const dtRetirada = med.data || med.criado_em;

                        return (
                            <div
                                key={med.id}
                                className="bg-white rounded-2xl border border-slate-200/90 hover:border-purple-200 shadow-2xs hover:shadow-xs transition-all overflow-hidden"
                            >
                                <div className="p-3.5 sm:p-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                                <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-purple-100 text-purple-800">
                                                    Farmácia Popular
                                                </span>
                                                {med.medicamento_categoria && (
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-100 text-slate-700 uppercase">
                                                        {med.medicamento_categoria}
                                                    </span>
                                                )}
                                                {med.lote && (
                                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono bg-slate-50 text-slate-500 border border-slate-200">
                                                        Lote: {med.lote}
                                                    </span>
                                                )}
                                            </div>

                                            <h3 className="text-sm sm:text-base font-black text-slate-900 tracking-tight leading-snug">
                                                {med.medicamento_nome}
                                            </h3>

                                            <p className="text-xs text-slate-500 font-medium mt-0.5">
                                                {med.medicamento_dosagem || med.medicamento_tipo ? `${med.medicamento_dosagem || ''} ${med.medicamento_tipo || ''}`.trim() : 'Forma farmacêutica padrão'}
                                            </p>
                                        </div>

                                        {/* Quantidade e Botão */}
                                        <div className="flex items-center gap-3 bg-purple-50/60 rounded-xl p-2 sm:p-2.5 border border-purple-200/60 shrink-0">
                                            <div className="text-center px-2">
                                                <span className="text-[10px] uppercase font-bold text-purple-600 block leading-none">
                                                    Entregue
                                                </span>
                                                <span className="text-base font-black text-purple-900 mt-0.5 block leading-none">
                                                    {med.quantidade} un
                                                </span>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => setExpandedMedId(isExpanded ? null : med.id)}
                                                className="p-1.5 rounded-lg text-purple-600 hover:text-purple-900 hover:bg-purple-100/60 transition-colors cursor-pointer"
                                                title={isExpanded ? 'Recolher detalhes' : 'Ver mais detalhes'}
                                            >
                                                {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Linha Resumo com Médico e Data */}
                                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                                        <span className="flex items-center gap-1 font-medium">
                                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                            Data da Retirada:{' '}
                                            <strong className="text-slate-700">
                                                {dtRetirada ? new Date(dtRetirada).toLocaleString('pt-BR') : '-'}
                                            </strong>
                                        </span>

                                        {(med.medico_crm || med.medico_nome) && (
                                            <span className="flex items-center gap-1 font-medium">
                                                <Stethoscope className="w-3.5 h-3.5 text-purple-600" />
                                                Prescritor:{' '}
                                                <strong className="text-slate-800">
                                                    {med.medico_nome || `CRM ${med.medico_crm || ''} ${med.medico_uf || ''}`}
                                                </strong>
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Detalhes Expansíveis */}
                                {isExpanded && (
                                    <div className="bg-slate-50/70 border-t border-slate-200/70 p-3.5 sm:p-4 space-y-3 animate-in fade-in duration-150">
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                                            <div className="bg-white p-2.5 rounded-xl border border-slate-200/70">
                                                <span className="text-[10px] uppercase font-bold text-slate-400 block">Prescritor Completo</span>
                                                <span className="font-extrabold text-slate-800">
                                                    {med.medico_nome ? `${med.medico_nome} ` : ''}
                                                    {med.medico_crm ? `(CRM: ${med.medico_crm} - ${med.medico_uf || 'MG'})` : 'Não informado'}
                                                </span>
                                            </div>

                                            <div className="bg-white p-2.5 rounded-xl border border-slate-200/70">
                                                <span className="text-[10px] uppercase font-bold text-slate-400 block">Dispensado Por</span>
                                                <span className="font-extrabold text-slate-800">
                                                    {med.responsavel_nome || 'Farmacêutico / Atendente'}
                                                </span>
                                            </div>

                                            <div className="bg-white p-2.5 rounded-xl border border-slate-200/70">
                                                <span className="text-[10px] uppercase font-bold text-slate-400 block">Validade do Lote</span>
                                                <span className="font-extrabold text-slate-800">
                                                    {med.validade ? new Date(med.validade).toLocaleDateString('pt-BR') : 'Não informada'}
                                                </span>
                                            </div>
                                        </div>

                                        {med.observacoes && (
                                            <div className="bg-white rounded-xl p-3 border border-slate-200/70 text-xs text-slate-700">
                                                <strong className="block font-black uppercase text-[10px] text-slate-500 mb-0.5">Observações da Dispensação:</strong>
                                                <span>{med.observacoes}</span>
                                            </div>
                                        )}

                                        <div className="text-[10px] font-mono text-slate-400">
                                            Identificador da Operação: {med.id}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
