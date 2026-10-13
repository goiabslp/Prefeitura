import React, { useState, useEffect, useMemo } from 'react';
import { ConsultaPaciente, User } from '../../../types';
import { normalizarNumeros, correspondeSequencialNome } from '../../../services/pacienteHistoricoService';
import * as db from '../../../services/consultasService';
import { Search, Plus, User as UserIcon, Phone, MapPin, Hash, ShieldCheck, ArrowRight, Loader2, ArrowLeft, AlertCircle, X, Users, CreditCard } from 'lucide-react';
import { PacienteFormModal } from './PacienteFormModal';

interface PacienteBuscaScreenProps {
    onSelectPaciente: (pacienteId: string) => void;
    onBack?: () => void;
    currentUser?: User | null;
}

export const PacienteBuscaScreen: React.FC<PacienteBuscaScreenProps> = ({
    onSelectPaciente,
    onBack,
    currentUser
}) => {
    const [pacientes, setPacientes] = useState<ConsultaPaciente[]>([]);
    const [loading, setLoading] = useState(true);

    const [termoBusca, setTermoBusca] = useState('');

    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [editingPatient, setEditingPatient] = useState<ConsultaPaciente | null>(null);

    const carregarPacientes = async () => {
        setLoading(true);
        try {
            const data = await db.getPacientes();
            setPacientes(data || []);
        } catch (err) {
            console.error('Erro ao carregar pacientes:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        carregarPacientes();
    }, []);

    // Pesquisa unificada que engloba tudo automaticamente:
    // CPF / Cartão SUS: correspondência exata após normalização.
    // Nome: correspondência sequencial de caracteres, sem utilizar contains genérico.
    const pacientesFiltrados = useMemo(() => {
        if (!termoBusca.trim()) {
            return pacientes.slice(0, 25);
        }

        const rawTerm = termoBusca.trim();
        const numTerm = normalizarNumeros(rawTerm);

        return pacientes.filter(p => {
            // Correspondência exata após normalização para CPF ou Cartão SUS
            const cpfExact = numTerm.length > 0 && normalizarNumeros(p.cpf) === numTerm;
            const susExact = numTerm.length > 0 && normalizarNumeros(p.sus_number) === numTerm;

            // Correspondência sequencial de caracteres para Nome completo ou apelido (sem contains)
            const nomeSeq = correspondeSequencialNome(p.name, rawTerm) || correspondeSequencialNome(p.nickname, rawTerm);

            return cpfExact || susExact || nomeSeq;
        });
    }, [pacientes, termoBusca]);

    const formatarCpf = (cpf?: string) => {
        if (!cpf) return 'Sem CPF';
        const c = normalizarNumeros(cpf);
        if (c.length === 11) return c.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
        return cpf;
    };

    return (
        <div className="flex-1 w-full h-full flex flex-col p-2 sm:p-3 overflow-hidden gap-2 bg-[#f8fafc]">
            {/* Header e Barra de Busca Integrados Ultra Compactos */}
            <div className="bg-white rounded-xl py-1.5 px-2.5 sm:px-3 border border-slate-200/90 shadow-2xs flex flex-col gap-1.5 shrink-0">
                {/* Linha Superior: Voltar + Título + Status + Botão Cadastrar */}
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        {onBack && (
                            <button
                                type="button"
                                onClick={onBack}
                                className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer shrink-0"
                                title="Voltar ao Menu de Regulação"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" />
                            </button>
                        )}
                        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-sky-500 to-sky-600 text-white flex items-center justify-center shadow-xs shrink-0">
                            <Users className="w-3.5 h-3.5" />
                        </div>
                        <div className="flex items-center gap-2 min-w-0 flex-wrap">
                            <h1 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight uppercase leading-none truncate">
                                Central de Gestão de Pacientes
                            </h1>
                            <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-sky-50 text-sky-700 border border-sky-200 whitespace-nowrap">
                                {loading ? 'Carregando...' : `${pacientesFiltrados.length} localizado(s)`}
                            </span>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            setEditingPatient(null);
                            setIsFormModalOpen(true);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-[10px] font-black uppercase tracking-wider shadow-xs active:scale-95 transition-all flex items-center gap-1 cursor-pointer shrink-0"
                    >
                        <Plus className="w-3 h-3" /> <span>Cadastrar Paciente</span>
                    </button>
                </div>

                {/* Linha Inferior: Campo Único de Busca */}
                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <input
                            type="text"
                            placeholder="Pesquisar por CPF, Cartão SUS ou Nome completo do paciente..."
                            value={termoBusca}
                            onChange={(e) => setTermoBusca(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-8 py-1.5 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-sky-500 focus:ring-1 focus:ring-sky-500/20 transition-all"
                        />
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        {termoBusca && (
                            <button
                                type="button"
                                onClick={() => setTermoBusca('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-600 p-1 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                                title="Limpar pesquisa"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                    <span className="text-slate-400 text-[9px] uppercase font-bold hidden md:inline shrink-0">
                        CPF/SUS exato • Nome sequencial
                    </span>
                </div>
            </div>

            {/* Listagem de Resultados */}
            <div className="flex-1 overflow-y-auto no-scrollbar min-h-0">
                {loading ? (
                    <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-400">
                        <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
                        <span className="text-xs font-bold">Consultando cadastro único municipal...</span>
                    </div>
                ) : pacientesFiltrados.length === 0 ? (
                    <div className="bg-white rounded-3xl p-8 border border-slate-200/90 text-center space-y-3">
                        <UserIcon className="w-12 h-12 text-slate-300 mx-auto" />
                        <h3 className="text-sm font-black uppercase text-slate-700">Nenhum paciente localizado</h3>
                        <p className="text-xs text-slate-400 max-w-md mx-auto">
                            Verifique se o CPF ou Cartão SUS foi digitado corretamente ou utilize a correspondência sequencial pelo início do nome.
                        </p>
                        <button
                            type="button"
                            onClick={() => {
                                setEditingPatient(null);
                                setIsFormModalOpen(true);
                            }}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-600 text-white text-xs font-black uppercase tracking-wider hover:bg-sky-700 transition-all cursor-pointer"
                        >
                            <Plus className="w-3.5 h-3.5" /> Cadastrar Este Paciente
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-2.5">
                        {pacientesFiltrados.map((paciente) => {
                            const cpfFormatado = formatarCpf(paciente.cpf);
                            const temPendenciaCadastro = !paciente.cpf || !paciente.sus_number || !paciente.phone || !paciente.birth_date;

                            return (
                                <div
                                    key={paciente.id}
                                    onClick={() => onSelectPaciente(paciente.id)}
                                    className="bg-white rounded-xl p-2.5 sm:p-3 border border-slate-200/90 hover:border-sky-300 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between group space-y-1.5"
                                >
                                    <div className="space-y-1">
                                        <div className="flex items-center justify-between gap-1.5">
                                            <div className="min-w-0 flex-1">
                                                <h3 className="text-xs sm:text-sm font-black text-slate-900 group-hover:text-sky-700 transition-colors uppercase tracking-tight truncate leading-tight">
                                                    {paciente.name}
                                                </h3>
                                                {paciente.nickname && (
                                                    <span className="text-[10px] font-bold text-slate-400 block truncate">
                                                        ({paciente.nickname})
                                                    </span>
                                                )}
                                            </div>

                                            {temPendenciaCadastro ? (
                                                <span className="px-1.5 py-0.2 rounded text-[8px] font-black uppercase bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                                                    Pendente
                                                </span>
                                            ) : (
                                                <span className="px-1.5 py-0.2 rounded text-[8px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                                                    Completo
                                                </span>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-1 text-[10px] sm:text-[11px] pt-0.5">
                                            <div className="flex items-center gap-1 text-slate-600 truncate">
                                                <CreditCard className="w-3 h-3 text-slate-400 shrink-0" />
                                                <span className="font-mono truncate">{cpfFormatado}</span>
                                            </div>

                                            <div className="flex items-center gap-1 text-slate-600 truncate">
                                                <Hash className="w-3 h-3 text-slate-400 shrink-0" />
                                                <span className="font-mono truncate">
                                                    {paciente.sus_number ? `SUS: ${paciente.sus_number}` : 'Sem SUS'}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-1 text-slate-600 truncate">
                                                <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                                                <span className="truncate">{paciente.phone || 'Sem tel'}</span>
                                            </div>

                                            <div className="flex items-center gap-1 text-slate-600 truncate">
                                                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                                <span className="truncate">{paciente.neighborhood || 'Bairro N/I'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Rodapé do Card com Ação */}
                                    <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[10px]">
                                        <span className="font-bold text-slate-400 uppercase truncate">
                                            {paciente.agente_saude ? `ACS: ${paciente.agente_saude}` : 'Sem Agente'}
                                        </span>

                                        <span className="text-sky-600 group-hover:text-sky-800 font-black uppercase tracking-wider flex items-center gap-0.5 shrink-0">
                                            Ver Histórico <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Modal de Cadastro de Paciente */}
            {isFormModalOpen && (
                <PacienteFormModal
                    isOpen={isFormModalOpen}
                    onClose={() => setIsFormModalOpen(false)}
                    editingPatient={editingPatient}
                    onSuccess={(pacienteSalvo) => {
                        carregarPacientes();
                        onSelectPaciente(pacienteSalvo.id);
                    }}
                />
            )}
        </div>
    );
};
