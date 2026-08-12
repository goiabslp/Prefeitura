import React from 'react';
import { createPortal } from 'react-dom';
import { User, AppState } from '../../types';
import { PageWrapper } from '../PageWrapper';
import { CalendarDays, User as UserIcon, ShieldCheck, FileText, Pill } from 'lucide-react';

interface FarmaciaPdfGeneratorProps {
    movimentacaoId: string;
    pacienteNome: string;
    pacienteCpf: string;
    pacienteApelido?: string;
    medicamentoNome: string;
    medicamentoCategoria: string;
    medicamentoDosagem?: string;
    medicamentoTipo?: string;
    lote: string;
    quantidade: number;
    unidade: string;
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
                <div className="flex flex-col gap-8 p-4">
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
                    <div className="grid grid-cols-1 gap-6">
                        <div className="bg-slate-50/50 border border-slate-200 rounded-2xl p-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-6 opacity-[0.03]">
                                <Pill className="w-48 h-48 text-slate-900" />
                            </div>

                            <div className="relative z-10 space-y-6">
                                <span className="inline-block px-3 py-1 rounded bg-pink-600 text-white text-[8pt] uppercase font-black tracking-widest">
                                    Dispensação Realizada
                                </span>

                                <div className="grid grid-cols-2 gap-8 border-t border-slate-200/80 pt-6">
                                    <div className="space-y-4">
                                        <h4 className="text-[9pt] font-black uppercase tracking-widest text-pink-600 flex items-center gap-2">
                                            <UserIcon className="w-4 h-4 text-pink-600" />
                                            Dados do Paciente
                                        </h4>
                                        <div className="space-y-2 text-xs">
                                            <div>
                                                <span className="block text-[7pt] font-bold uppercase text-slate-400 tracking-wider">Nome Completo</span>
                                                <span className="font-extrabold text-slate-800 text-sm">
                                                    {pacienteApelido ? `${pacienteNome} (${pacienteApelido})` : pacienteNome}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="block text-[7pt] font-bold uppercase text-slate-400 tracking-wider">CPF</span>
                                                <span className="font-bold text-slate-800">
                                                    {pacienteCpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h4 className="text-[9pt] font-black uppercase tracking-widest text-slate-700 flex items-center gap-2">
                                            <Pill className="w-4 h-4 text-slate-700" />
                                            Dados da Retirada
                                        </h4>
                                        <div className="space-y-2 text-xs">
                                            <div>
                                                <span className="block text-[7pt] font-bold uppercase text-slate-400 tracking-wider">Medicamento</span>
                                                <span className="font-extrabold text-slate-800 text-sm uppercase">
                                                    {medicamentoNome} {medicamentoDosagem ? `(${medicamentoDosagem})` : ''} {medicamentoTipo ? `• ${medicamentoTipo}` : ''}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <span className="block text-[7pt] font-bold uppercase text-slate-400 tracking-wider">Lote</span>
                                                    <span className="font-bold text-slate-850 uppercase font-mono">{lote}</span>
                                                </div>
                                                <div>
                                                    <span className="block text-[7pt] font-bold uppercase text-slate-400 tracking-wider">Categoria</span>
                                                    <span className="font-bold text-slate-800 uppercase">{medicamentoCategoria}</span>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <span className="block text-[7pt] font-bold uppercase text-slate-400 tracking-wider">Quantidade</span>
                                                    <span className="font-extrabold text-pink-650 text-sm">{quantidade} {unidade}</span>
                                                </div>
                                                <div>
                                                    <span className="block text-[7pt] font-bold uppercase text-slate-400 tracking-wider">Data / Horário</span>
                                                    <span className="font-bold text-slate-800">{formatDateTimeBr(data)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {observacoes && (
                                    <div className="border-t border-slate-200/80 pt-4 text-xs">
                                        <span className="block text-[7pt] font-bold uppercase text-slate-400 tracking-wider">Observações / Receita</span>
                                        <span className="text-slate-700 block whitespace-pre-line leading-relaxed">{observacoes}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Informações de Auditoria e Assinatura */}
                        <div className="grid grid-cols-2 gap-8 pt-8 mt-12 border-t border-slate-100">
                            <div className="space-y-2 text-xs">
                                <span className="block text-[7pt] font-black uppercase tracking-widest text-slate-400">Responsável pela Dispensação</span>
                                <div className="font-bold text-slate-800">{currentUser?.name || ''}</div>
                                <div className="text-[8pt] text-slate-400 font-semibold">{currentUser?.jobTitle || 'Responsável Farmácia'}</div>
                            </div>
                            <div className="space-y-2 text-xs text-right">
                                <span className="block text-[7pt] font-black uppercase tracking-widest text-slate-400">Autenticação do Sistema</span>
                                <div className="font-mono text-[8pt] text-slate-500 font-bold uppercase tracking-wider">{movimentacaoId}</div>
                                <div className="text-[8pt] text-slate-400 font-semibold">{new Date().toLocaleString('pt-BR')}</div>
                            </div>
                        </div>

                        {/* Nota de rodapé legal */}
                        <div className="mt-12 p-4 bg-slate-50 border border-slate-200/80 rounded-xl text-center text-[7pt] font-bold uppercase tracking-wider text-slate-400 leading-relaxed">
                            Este é um documento oficial emitido eletronicamente pela Farmácia Popular Integrada.
                        </div>
                    </div>
                </div>
            </PageWrapper>
        </div>,
        document.body
    );
};
