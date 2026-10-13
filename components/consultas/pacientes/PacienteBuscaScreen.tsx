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
        <div className="flex-1 w-full h-full flex flex-col p-3 sm:p-5 overflow-hidden gap-3.5">
            {/* Header com Navegação e Título */}
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3">
                    {onBack && (
                        <button
                            type="button"
                            onClick={onBack}
                            className="p-2 sm:p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer shrink-0"
                            title="Voltar ao Menu de Regulação"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </button>
                    )}
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-500 to-sky-600 text-white flex items-center justify-center shadow-md shadow-sky-500/20 shrink-0">
                        <Users className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tight uppercase leading-tight">
                            Central de Gestão de Pacientes
                        </h1>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            Localização de Prontuários e Histórico Integrado (Regulação & Farmácia)
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => {
                        setEditingPatient(null);
                        setIsFormModalOpen(true);
                    }}
                    className="px-4 py-2.5 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black uppercase tracking-wider shadow-md shadow-sky-600/20 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer shrink-0"
                >
                    <Plus className="w-4 h-4" /> <span>Cadastrar Paciente</span>
                </button>
            </div>

            {/* Caixa de Busca Unificada (1 Único Campo que engloba tudo) */}
            <div className="bg-white rounded-3xl p-3.5 sm:p-4 border border-slate-200/90 shadow-2xs space-y-2.5 shrink-0">
                <div className="relative w-full">
                    <input
                        type="text"
                        placeholder="Pesquisar por CPF, Cartão SUS ou Nome completo do paciente..."
                        value={termoBusca}
                        onChange={(e) => setTermoBusca(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-11 pr-10 py-3 text-xs sm:text-sm font-bold text-slate-800 placeholder:text-slate-400 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10 transition-all shadow-2xs"
                    />
                    <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    {termoBusca && (
                        <button
                            type="button"
                            onClick={() => setTermoBusca('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                            title="Limpar pesquisa"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold px-1">
                    <span>
                        {loading
                            ? 'Carregando base de pacientes...'
                            : `${pacientesFiltrados.length} paciente(s) localizado(s) ${
                                  termoBusca ? 'para esta busca' : '(amostragem inicial)'
                              }`}
                    </span>
                    <span className="text-slate-400 text-[10px] uppercase font-extrabold hidden sm:inline">
                        Regra: Correspondência exata para CPF/SUS e sequencial para Nome
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
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                        {pacientesFiltrados.map((paciente) => {
                            const cpfFormatado = formatarCpf(paciente.cpf);
                            const temPendenciaCadastro = !paciente.cpf || !paciente.sus_number || !paciente.phone || !paciente.birth_date;

                            return (
                                <div
                                    key={paciente.id}
                                    onClick={() => onSelectPaciente(paciente.id)}
                                    className="bg-white rounded-3xl p-4 border border-slate-200/90 hover:border-sky-300 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer flex flex-col justify-between group space-y-3"
                                >
                                    <div className="space-y-2">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 flex-1">
                                                <h3 className="text-sm font-black text-slate-900 group-hover:text-sky-700 transition-colors uppercase tracking-tight truncate leading-snug">
                                                    {paciente.name}
                                                </h3>
                                                {paciente.nickname && (
                                                    <span className="text-[11px] font-bold text-slate-400 block truncate">
                                                        ({paciente.nickname})
                                                    </span>
                                                )}
                                            </div>

                                            {temPendenciaCadastro ? (
                                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                                                    Pendente
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                                                    Completo
                                                </span>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                                            <div className="flex items-center gap-1.5 text-slate-600 truncate">
                                                <CreditCard className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                <span className="font-mono truncate">{cpfFormatado}</span>
                                            </div>

                                            <div className="flex items-center gap-1.5 text-slate-600 truncate">
                                                <Hash className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                <span className="font-mono truncate">
                                                    {paciente.sus_number ? `SUS: ${paciente.sus_number}` : 'Sem SUS'}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-1.5 text-slate-600 truncate">
                                                <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                <span className="truncate">{paciente.phone || 'Sem telefone'}</span>
                                            </div>

                                            <div className="flex items-center gap-1.5 text-slate-600 truncate">
                                                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                <span className="truncate">{paciente.neighborhood || 'Bairro N/I'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Rodapé do Card com Ação */}
                                    <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase truncate">
                                            {paciente.agente_saude ? `ACS: ${paciente.agente_saude}` : 'Sem Agente'}
                                        </span>

                                        <span className="text-sky-600 group-hover:text-sky-800 font-black text-[11px] uppercase tracking-wider flex items-center gap-1 shrink-0">
                                            Abrir Dashboard <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
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
