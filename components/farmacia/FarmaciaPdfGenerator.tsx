import React from 'react';
import { createPortal } from 'react-dom';
import { User, AppState } from '../../types';
import { PageWrapper } from '../PageWrapper';
import { Pill } from 'lucide-react';

export interface DispensedItem {
    medicamentoNome: string;
    medicamentoCategoria: string;
    medicamentoDosagem?: string;
    medicamentoTipo?: string;
    lote: string;
    quantidade: number;
    unidade: string;
}

interface FarmaciaPdfGeneratorProps {
    movimentacaoId: string;
    pacienteNome: string;
    pacienteCpf: string;
    pacienteApelido?: string;
    medicamentoNome?: string;
    medicamentoCategoria?: string;
    medicamentoDosagem?: string;
    medicamentoTipo?: string;
    lote?: string;
    quantidade?: number;
    unidade?: string;
    medicoNome?: string;
    medicoCrm?: string;
    medicoUf?: string;
    itens?: DispensedItem[];
    data: string;
    observacoes?: string;
    currentUser?: User | null;
    state: AppState;
}

export const FarmaciaPdfGenerator: React.FC<FarmaciaPdfGeneratorProps> = ({
    movimentacaoId,
    pacienteNome,
    pacienteCpf,
    pacienteApelido,
    medicamentoNome,
    medicamentoCategoria,
    medicamentoDosagem,
    medicamentoTipo,
    lote,
    quantidade,
    unidade,
    medicoNome,
    medicoCrm,
    medicoUf,
    itens,
    data,
    observacoes,
    currentUser,
    state
}) => {
    const formatDateTimeBr = (d: string) => {
        if (!d) return '';
        const dateObj = new Date(d);
        if (isNaN(dateObj.getTime())) return d;
        const pad = (n: number) => String(n).padStart(2, '0');
        const day = pad(dateObj.getDate());
        const month = pad(dateObj.getMonth() + 1);
        const year = dateObj.getFullYear();
        const hours = pad(dateObj.getHours());
        const minutes = pad(dateObj.getMinutes());
        const seconds = pad(dateObj.getSeconds());
        return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    };

    const itemList: DispensedItem[] = itens && itens.length > 0
        ? itens
        : (medicamentoNome ? [{
            medicamentoNome,
            medicamentoCategoria: medicamentoCategoria || 'CBAF',
            medicamentoDosagem,
            medicamentoTipo,
            lote: lote || 'N/I',
            quantidade: quantidade || 1,
            unidade: unidade || 'UN'
        }] : []);

    return createPortal(
        <div
            id="farmacia-pdf-content"
            style={{
                position: 'fixed',
                left: '-10000px',
                top: '0',
                width: '210mm',
                background: 'white',
                zIndex: -1
            }}
        >
            <PageWrapper
                state={{
                    ...state,
                    branding: {
                        ...state.branding,
                        watermark: {
                            ...state.branding?.watermark,
                            enabled: false
                        }
                    },
                    content: {
                        ...state.content,
                        title: 'COMPROVANTE DE RETIRADA DE MEDICAMENTO',
                        protocol: movimentacaoId.substring(0, 8).toUpperCase()
                    }
                }}
                pageIndex={0}
                totalPages={1}
                isGenerating={true}
            >
                <div className="flex flex-col gap-6 p-4">
                    {/* Header Title */}
                    <div className="border-b-2 border-slate-900 pb-4 flex items-center justify-between">
                        <div>
                            <h1 className="text-[18pt] font-black uppercase tracking-tight text-slate-900">Comprovante de Retirada</h1>
                            <p className="text-[9pt] font-bold text-slate-500 uppercase tracking-widest mt-1">Farmácia Popular Integrada</p>
                        </div>
                        <div className="px-4 py-2 border border-slate-200 rounded-xl bg-slate-50 text-right">
                            <span className="block text-[7pt] font-black uppercase tracking-widest text-slate-400">Identificação da Retirada</span>
                            <span className="text-[11pt] font-mono font-black text-slate-800">{movimentacaoId.substring(0, 8).toUpperCase()}</span>
                        </div>
                    </div>

                    {/* Voucher Card details */}
                    <div className="bg-slate-50/50 border border-slate-200 rounded-2xl p-6 relative overflow-hidden space-y-5">
                        <div className="flex justify-between items-center border-b border-slate-200/80 pb-4">
                            <span className="inline-block px-3 py-1 rounded bg-pink-600 text-white text-[8pt] uppercase font-black tracking-widest">
                                Dispensação Realizada ({itemList.length} {itemList.length === 1 ? 'item' : 'itens'})
                            </span>
                            <span className="text-[9pt] font-bold text-slate-600">
                                Data/Hora: <strong>{formatDateTimeBr(data)}</strong>
                            </span>
                        </div>

                        {/* Dados do Paciente e Médico Prescritor CFM */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white border border-slate-200 rounded-xl p-4">
                                <span className="block text-[7pt] font-bold uppercase text-slate-400 tracking-wider">Paciente / Beneficiário</span>
                                <span className="font-extrabold text-slate-800 text-xs uppercase block truncate">
                                    {pacienteApelido ? `${pacienteNome} (${pacienteApelido})` : pacienteNome}
                                </span>
                                <span className="text-[8pt] font-bold text-slate-500 font-mono block mt-0.5">
                                    CPF: {pacienteCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}
                                </span>
                            </div>

                            <div className="bg-white border border-slate-200 rounded-xl p-4">
                                <span className="block text-[7pt] font-bold uppercase text-slate-400 tracking-wider">Médico Prescritor</span>
                                <span className="font-extrabold text-purple-950 text-xs uppercase block truncate">
                                    {medicoCrm ? `CRM: ${medicoCrm}${medicoUf ? '/' + medicoUf : ''}` : 'NÃO INFORMADO'}
                                </span>
                            </div>
                        </div>

                        {/* Tabela de Medicamentos Dispensados */}
                        <div className="space-y-2">
                            <h4 className="text-[9pt] font-black uppercase tracking-widest text-slate-700 flex items-center gap-2">
                                <Pill className="w-4 h-4 text-pink-600" />
                                Medicamentos Entregues
                            </h4>
                            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-100/70 border-b border-slate-200 text-[8pt] font-black text-slate-600 uppercase tracking-wider">
                                            <th className="p-2.5">Medicamento / Dosagem</th>
                                            <th className="p-2.5">Lote</th>
                                            <th className="p-2.5">Cat.</th>
                                            <th className="p-2.5 text-right">Qtd.</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-800">
                                        {itemList.map((item, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/50">
                                                <td className="p-2.5 uppercase font-bold text-slate-900">
                                                    {item.medicamentoNome} {item.medicamentoDosagem ? `(${item.medicamentoDosagem})` : ''} {item.medicamentoTipo ? `• ${item.medicamentoTipo}` : ''}
                                                </td>
                                                <td className="p-2.5 font-mono text-[10px] font-bold text-slate-600 uppercase">
                                                    {item.lote}
                                                </td>
                                                <td className="p-2.5 text-[9px] font-extrabold text-pink-700 uppercase">
                                                    {item.medicamentoCategoria}
                                                </td>
                                                <td className="p-2.5 text-right font-black text-pink-650">
                                                    {item.quantidade} {item.unidade}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Observações adicionais */}
                        {observacoes && (
                            <div className="p-3 bg-amber-50/60 border border-amber-200/70 rounded-xl text-xs space-y-1">
                                <span className="text-[7pt] font-black uppercase text-amber-800 tracking-wider">Observações:</span>
                                <p className="text-amber-950 font-semibold leading-relaxed">{observacoes}</p>
                            </div>
                        )}
                    </div>

                    {/* Informações de Auditoria e Assinatura */}
                    <div className="grid grid-cols-2 gap-8 pt-4 border-t border-slate-200">
                        <div className="space-y-1 text-xs">
                            <span className="block text-[7pt] font-black uppercase tracking-widest text-slate-400">Responsável pela Dispensação</span>
                            <div className="font-bold text-slate-800">{currentUser?.name || ''}</div>
                            <div className="text-[8pt] text-slate-400 font-semibold">{currentUser?.jobTitle || 'Responsável Farmácia'}</div>
                        </div>
                        <div className="space-y-1 text-xs text-right">
                            <span className="block text-[7pt] font-black uppercase tracking-widest text-slate-400">Autenticação do Sistema</span>
                            <div className="font-mono text-[8pt] text-slate-500 font-bold uppercase tracking-wider">{movimentacaoId}</div>
                            <div className="text-[8pt] text-slate-400 font-semibold">{new Date().toLocaleString('pt-BR')}</div>
                        </div>
                    </div>

                    {/* Nota de rodapé legal */}
                    <div className="p-3 bg-slate-50 border border-slate-200/80 rounded-xl text-center text-[7pt] font-bold uppercase tracking-wider text-slate-400 leading-relaxed">
                        Este é um documento oficial emitido eletronicamente pela Farmácia Popular Integrada.
                    </div>
                </div>
            </PageWrapper>
        </div>,
        document.body
    );
};
