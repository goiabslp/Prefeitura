import React, { useState, useEffect } from 'react';
import { ConsultaPaciente } from '../../../types';
import { useAgentesSaude } from '../../../services/agentesSaudeService';
import * as db from '../../../services/consultasService';
import { X, User, Save, Loader2, AlertTriangle, ShieldCheck } from 'lucide-react';

interface PacienteFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (paciente: ConsultaPaciente) => void;
    editingPatient?: ConsultaPaciente | null;
}

export const PacienteFormModal: React.FC<PacienteFormModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    editingPatient
}) => {
    const { items: agentesSaudeItems } = useAgentesSaude();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [nome, setNome] = useState('');
    const [apelido, setApelido] = useState('');
    const [cpf, setCpf] = useState('');
    const [dataNascimento, setDataNascimento] = useState('');
    const [telefone, setTelefone] = useState('');
    const [bairro, setBairro] = useState('');
    const [rua, setRua] = useState('');
    const [cidade, setCidade] = useState('SÃO JOSÉ DO GOIABAL -MG');
    const [susNumber, setSusNumber] = useState('');
    const [agenteSaude, setAgenteSaude] = useState('');

    useEffect(() => {
        if (editingPatient) {
            setNome(editingPatient.name || '');
            setApelido(editingPatient.nickname || '');
            setCpf(editingPatient.cpf || '');
            setDataNascimento(editingPatient.birth_date || '');
            setTelefone(editingPatient.phone || '');
            setBairro(editingPatient.neighborhood || '');
            setRua(editingPatient.street || '');
            setCidade(editingPatient.city || 'SÃO JOSÉ DO GOIABAL -MG');
            setSusNumber(editingPatient.sus_number || '');
            setAgenteSaude(editingPatient.agente_saude || '');
        } else {
            setNome('');
            setApelido('');
            setCpf('');
            setDataNascimento('');
            setTelefone('');
            setBairro('');
            setRua('');
            setCidade('SÃO JOSÉ DO GOIABAL -MG');
            setSusNumber('');
            setAgenteSaude('');
        }
        setError('');
    }, [editingPatient, isOpen]);

    if (!isOpen) return null;

    const handleCpfChange = (val: string) => {
        const numbers = val.replace(/\D/g, '').slice(0, 11);
        let masked = numbers;
        if (numbers.length > 9) masked = numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
        else if (numbers.length > 6) masked = numbers.replace(/(\d{3})(\d{3})(\d{1,3})/, '$1.$2.$3');
        else if (numbers.length > 3) masked = numbers.replace(/(\d{3})(\d{1,3})/, '$1.$2');
        setCpf(masked);
    };

    const handleTelefoneChange = (val: string) => {
        const numbers = val.replace(/\D/g, '').slice(0, 11);
        let masked = numbers;
        if (numbers.length > 10) masked = numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
        else if (numbers.length > 6) masked = numbers.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
        else if (numbers.length > 2) masked = numbers.replace(/(\d{2})(\d{0,5})/, '($1) $2');
        setTelefone(masked);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const cleanCpf = cpf.replace(/\D/g, '');
        if (cleanCpf.length !== 11) {
            setError('O CPF deve conter exatamente 11 dígitos.');
            return;
        }

        if (!nome.trim()) {
            setError('O Nome Completo é obrigatório.');
            return;
        }

        if (!dataNascimento) {
            setError('A Data de Nascimento é obrigatória.');
            return;
        }

        setLoading(true);
        try {
            const payload = {
                name: nome.trim().toUpperCase(),
                nickname: apelido.trim() ? apelido.trim().toUpperCase() : null,
                cpf: cleanCpf,
                birth_date: dataNascimento,
                phone: telefone.trim() || null,
                neighborhood: bairro.trim() ? bairro.trim().toUpperCase() : null,
                street: rua.trim() ? rua.trim().toUpperCase() : null,
                city: cidade.trim() ? cidade.trim().toUpperCase() : 'SÃO JOSÉ DO GOIABAL -MG',
                sus_number: susNumber.trim() || null,
                agente_saude: agenteSaude ? agenteSaude.toUpperCase() : null
            };

            let saved: ConsultaPaciente | null = null;
            if (editingPatient) {
                saved = await db.updatePaciente(editingPatient.id, payload as any);
            } else {
                saved = await db.createPaciente(payload as any);
            }

            if (saved) {
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('consultas-pacientes-changed', { detail: saved }));
                    window.dispatchEvent(new CustomEvent('paciente-alterado', { detail: saved }));
                }
                onSuccess(saved);
                onClose();
            } else {
                setError('Não foi possível salvar o paciente no banco de dados.');
            }
        } catch (err: any) {
            console.error('Erro ao salvar paciente:', err);
            setError(err.message || 'Erro ao salvar paciente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="p-4 sm:p-5 bg-gradient-to-r from-sky-600 to-indigo-600 text-white flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center border border-white/20">
                            <User className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h3 className="text-base font-black tracking-tight">
                                {editingPatient ? 'Editar Cadastro do Paciente' : 'Novo Paciente no Sistema'}
                            </h3>
                            <p className="text-xs text-sky-100 font-medium">
                                Base Integrada Municipal de Saúde (Regulação & Farmácia Popular)
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                        title="Fechar"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Formulário com scroll interno e sem barra visível */}
                <form onSubmit={handleSave} className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4 no-scrollbar">
                    {error && (
                        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-3 text-xs text-rose-800 flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div className="sm:col-span-2">
                            <label className="text-xs font-black uppercase tracking-wider text-slate-700 block mb-1">
                                Nome Completo *
                            </label>
                            <input
                                type="text"
                                required
                                value={nome}
                                onChange={(e) => setNome(e.target.value)}
                                placeholder="Nome completo do paciente"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-500/10 transition-all uppercase"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-black uppercase tracking-wider text-slate-700 block mb-1">
                                Apelido / Como prefere ser chamado
                            </label>
                            <input
                                type="text"
                                value={apelido}
                                onChange={(e) => setApelido(e.target.value)}
                                placeholder="Apelido opcional"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-sky-500 transition-all uppercase"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-black uppercase tracking-wider text-slate-700 block mb-1">
                                CPF *
                            </label>
                            <input
                                type="text"
                                required
                                value={cpf}
                                onChange={(e) => handleCpfChange(e.target.value)}
                                placeholder="000.000.000-00"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-sky-500 transition-all"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-black uppercase tracking-wider text-slate-700 block mb-1">
                                Data de Nascimento *
                            </label>
                            <input
                                type="date"
                                required
                                value={dataNascimento}
                                onChange={(e) => setDataNascimento(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-sky-500 transition-all"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-black uppercase tracking-wider text-slate-700 block mb-1">
                                Telefone de Contato
                            </label>
                            <input
                                type="text"
                                value={telefone}
                                onChange={(e) => handleTelefoneChange(e.target.value)}
                                placeholder="(00) 00000-0000"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-sky-500 transition-all"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-black uppercase tracking-wider text-slate-700 block mb-1">
                                Cartão SUS (CNS)
                            </label>
                            <input
                                type="text"
                                value={susNumber}
                                onChange={(e) => setSusNumber(e.target.value.replace(/\D/g, '').slice(0, 15))}
                                placeholder="15 dígitos do Cartão SUS"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-sky-500 transition-all font-mono"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-black uppercase tracking-wider text-slate-700 block mb-1">
                                Agente Comunitário de Saúde (ACS)
                            </label>
                            <select
                                value={agenteSaude}
                                onChange={(e) => setAgenteSaude(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-sky-500 transition-all uppercase"
                            >
                                <option value="">Selecione o Agente de Saúde...</option>
                                {agentesSaudeItems.map(a => (
                                    <option key={a.id} value={a.nome}>
                                        {a.nome} {a.psf ? `(${a.psf})` : ''}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-xs font-black uppercase tracking-wider text-slate-700 block mb-1">
                                Bairro
                            </label>
                            <input
                                type="text"
                                value={bairro}
                                onChange={(e) => setBairro(e.target.value)}
                                placeholder="Nome do Bairro"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-sky-500 transition-all uppercase"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-black uppercase tracking-wider text-slate-700 block mb-1">
                                Endereço / Rua / Número
                            </label>
                            <input
                                type="text"
                                value={rua}
                                onChange={(e) => setRua(e.target.value)}
                                placeholder="Logradouro completo"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:bg-white focus:border-sky-500 transition-all uppercase"
                            />
                        </div>
                    </div>

                    <div className="p-3 bg-sky-50/50 rounded-2xl border border-sky-100 flex items-center gap-2 text-xs text-sky-800">
                        <ShieldCheck className="w-4 h-4 text-sky-600 shrink-0" />
                        <span>Este cadastro é compartilhado de forma unificada entre a Regulação e a Farmácia Popular sem duplicar dados.</span>
                    </div>

                    {/* Botões do Rodapé */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-black uppercase text-slate-600 hover:bg-slate-50 transition-all cursor-pointer"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black uppercase tracking-wider shadow-md shadow-sky-600/20 active:scale-95 transition-all flex items-center gap-2 cursor-pointer"
                        >
                            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                            <span>Salvar Paciente</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
