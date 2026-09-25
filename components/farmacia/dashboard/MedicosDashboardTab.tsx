import React, { useState, useEffect, useMemo } from 'react';
import { FarmaciaMedicamento, FarmaciaMovimentacao, FarmaciaMedico } from '../../../types';
import * as db from '../../../services/farmaciaService';
import {
    Stethoscope, Search, Filter, Calendar, Users, Package, FileText, Activity,
    TrendingUp, ArrowUpDown, ChevronRight, X, Download, ShieldCheck, MapPin,
    BarChart3, PieChart as PieIcon, Clock, CheckCircle2, AlertCircle, Pill, ChevronDown,
    RefreshCw, Edit3, Save, Check, UserCheck, Plus, Sparkles, Info, Layers, Brain
} from 'lucide-react';
import {
    ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
    PieChart, Pie, Cell
} from 'recharts';
import { format, isWithinInterval, parseISO, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface MedicosDashboardTabProps {
    medicamentos: FarmaciaMedicamento[];
    movimentacoes: FarmaciaMovimentacao[];
    onNavigate?: (view: string) => void;
}

export type TipoProfissionalPrescritor = 'medico' | 'enfermeiro' | 'dentista' | 'farmaceutico' | 'psicologo' | 'fisioterapeuta';

export interface ProfissionalConfig {
    id: TipoProfissionalPrescritor;
    label: string;
    conselho: string;
    artigo: string;
    icon: any;
    color: string;
    badgeBg: string;
    badgeText: string;
    badgeBorder: string;
    ringColor: string;
}

export const PROFISSIONAIS_CONFIG: Record<TipoProfissionalPrescritor, ProfissionalConfig> = {
    medico: {
        id: 'medico',
        label: 'Médico',
        conselho: 'CRM',
        artigo: 'do',
        icon: Stethoscope,
        color: 'pink',
        badgeBg: 'bg-pink-50',
        badgeText: 'text-pink-700',
        badgeBorder: 'border-pink-200/80',
        ringColor: 'ring-pink-500/20'
    },
    enfermeiro: {
        id: 'enfermeiro',
        label: 'Enfermeiro',
        conselho: 'COREN',
        artigo: 'do',
        icon: UserCheck,
        color: 'blue',
        badgeBg: 'bg-blue-50',
        badgeText: 'text-blue-700',
        badgeBorder: 'border-blue-200/80',
        ringColor: 'ring-blue-500/20'
    },
    dentista: {
        id: 'dentista',
        label: 'Dentista',
        conselho: 'CRO',
        artigo: 'do',
        icon: Activity,
        color: 'indigo',
        badgeBg: 'bg-indigo-50',
        badgeText: 'text-indigo-700',
        badgeBorder: 'border-indigo-200/80',
        ringColor: 'ring-indigo-500/20'
    },
    farmaceutico: {
        id: 'farmaceutico',
        label: 'Farmacêutico',
        conselho: 'CRF',
        artigo: 'do',
        icon: Pill,
        color: 'emerald',
        badgeBg: 'bg-emerald-50',
        badgeText: 'text-emerald-700',
        badgeBorder: 'border-emerald-200/80',
        ringColor: 'ring-emerald-500/20'
    },
    psicologo: {
        id: 'psicologo',
        label: 'Psicólogo',
        conselho: 'CRP',
        artigo: 'do',
        icon: Brain,
        color: 'purple',
        badgeBg: 'bg-purple-50',
        badgeText: 'text-purple-700',
        badgeBorder: 'border-purple-200/80',
        ringColor: 'ring-purple-500/20'
    },
    fisioterapeuta: {
        id: 'fisioterapeuta',
        label: 'Fisioterapeuta',
        conselho: 'CREFITO',
        artigo: 'do',
        icon: Sparkles,
        color: 'amber',
        badgeBg: 'bg-amber-50',
        badgeText: 'text-amber-800',
        badgeBorder: 'border-amber-200/80',
        ringColor: 'ring-amber-500/20'
    }
};

export const LISTA_PROFISSIONAIS_PRESCRITORES = Object.values(PROFISSIONAIS_CONFIG);

export interface NormalizedMedico {
    key: string; // "CRM_12345_MG" ou "12345_MG"
    tipoProfissional: TipoProfissionalPrescritor;
    conselho: string; // "CRM", "COREN", "CRO", "CRF", "CRP", "CREFITO"
    labelProfissional: string; // "Médico", "Enfermeiro", etc.
    crm: string; // "12345" (número de registro)
    registro: string; // "12345"
    uf: string; // "MG"
    nomeCadastrado?: string; // "Dr. João da Silva"
    displayCrmUf: string; // "CRM 12345 / MG"
    fullDisplayName: string; // "Dr. João da Silva — CRM 12345/MG" ou "CRM 12345 / MG"
    rawCrms: Set<string>;
    rawUfs: Set<string>;
    rawNomes: Set<string>;
    totalReceitas: number; // Quantidade de receitas/retiradas distintas
    totalItensEntregues: number; // Quantidade de registros de medicamentos dispensados (1 medicamento registrado = 1 item)
    totalQuantidadeFisica: number; // Soma física de comprimidos/unidades/ml
    totalPrescricoes: number; // Compatibilidade retroativa
    totalUnidades: number; // Compatibilidade retroativa
    medicamentosDistintos: Set<string>;
    receitasSet: Set<string>;
    ultimaPrescricao: string; // ISO date
    primeiraPrescricao: string; // ISO date
    movimentacoes: FarmaciaMovimentacao[];
    medsMap: Record<string, {
        nome: string;
        categoria: string;
        totalItens: number; // Quantidade de vezes prescrito (itens)
        quantidadeFisica: number; // Quantidade física somada
        receitas: Set<string>;
        datas: string[];
        prescricoes: number; // Compatibilidade
        unidades: number; // Compatibilidade
    }>;
}

export function detectTipoProfissional(
    rawCrm?: string,
    rawUf?: string,
    observacoes?: string,
    explicitTipo?: string,
    explicitConselho?: string
): { 
    tipo: TipoProfissionalPrescritor; 
    conselho: string; 
    registro: string; 
    uf: string; 
    displayRegistroUf: string;
    key: string;
} | null {
    let str = (rawCrm || '').trim();
    let uf = (rawUf || '').trim().toUpperCase();
    let tipo: TipoProfissionalPrescritor = 'medico';
    let conselho = 'CRM';

    if (!str && !uf && !observacoes && !explicitTipo && !explicitConselho) return null;

    if (explicitConselho) {
        const c = explicitConselho.toUpperCase();
        if (c === 'COREN') { tipo = 'enfermeiro'; conselho = 'COREN'; }
        else if (c === 'CRO') { tipo = 'dentista'; conselho = 'CRO'; }
        else if (c === 'CRF') { tipo = 'farmaceutico'; conselho = 'CRF'; }
        else if (c === 'CRP') { tipo = 'psicologo'; conselho = 'CRP'; }
        else if (c === 'CREFITO') { tipo = 'fisioterapeuta'; conselho = 'CREFITO'; }
        else { tipo = 'medico'; conselho = 'CRM'; }
    } else if (explicitTipo) {
        const t = explicitTipo.toLowerCase();
        if (t === 'enfermeiro' || t === 'coren') { tipo = 'enfermeiro'; conselho = 'COREN'; }
        else if (t === 'dentista' || t === 'cro') { tipo = 'dentista'; conselho = 'CRO'; }
        else if (t === 'farmaceutico' || t === 'crf') { tipo = 'farmaceutico'; conselho = 'CRF'; }
        else if (t === 'psicologo' || t === 'crp') { tipo = 'psicologo'; conselho = 'CRP'; }
        else if (t === 'fisioterapeuta' || t === 'crefito') { tipo = 'fisioterapeuta'; conselho = 'CREFITO'; }
        else { tipo = 'medico'; conselho = 'CRM'; }
    }

    const fullText = `${str} ${observacoes || ''}`.toUpperCase();
    if (!explicitConselho && !explicitTipo) {
        if (fullText.includes('COREN')) { tipo = 'enfermeiro'; conselho = 'COREN'; }
        else if (fullText.includes('CREFITO')) { tipo = 'fisioterapeuta'; conselho = 'CREFITO'; }
        else if (fullText.includes('CRO')) { tipo = 'dentista'; conselho = 'CRO'; }
        else if (fullText.includes('CRF')) { tipo = 'farmaceutico'; conselho = 'CRF'; }
        else if (fullText.includes('CRP')) { tipo = 'psicologo'; conselho = 'CRP'; }
    }

    // Extrair UF embutida: "CRM-MG 12345", "12345/MG", "MG 12345"
    const embeddedUfMatch = str.match(/(?:CRM|COREN|CRO|CRF|CRP|CREFITO)?\s*[-/.]?\s*([A-Za-z]{2})\s*[-/.]?\s*(\d+)/i) ||
                            str.match(/(\d+)\s*[-/.]?\s*([A-Za-z]{2})/i);

    if (embeddedUfMatch) {
        if (isNaN(Number(embeddedUfMatch[1]))) {
            uf = embeddedUfMatch[1].toUpperCase();
            str = embeddedUfMatch[2];
        } else {
            str = embeddedUfMatch[1];
            uf = embeddedUfMatch[2].toUpperCase();
        }
    }

    // Limpar prefixos e manter apenas números do registro
    let registro = str.replace(/(?:CRM|COREN|CRO|CRF|CRP|CREFITO)/gi, '').replace(/[^\d]/g, '');

    // Se ainda não temos registro, tenta procurar no campo observações
    if (!registro && observacoes) {
        const obsMatch = observacoes.match(/(?:CRM|COREN|CRO|CRF|CRP|CREFITO)\s*[:.-]?\s*(\d+)(?:\s*[-/]?\s*([A-Za-z]{2}))?/i);
        if (obsMatch) {
            registro = obsMatch[1];
            if (obsMatch[2]) uf = obsMatch[2].toUpperCase();
        }
    }

    if (!registro) return null;

    if (!uf || uf.length !== 2 || !/^[A-Z]{2}$/.test(uf)) {
        uf = 'MG';
    }

    return {
        tipo,
        conselho,
        registro,
        uf,
        displayRegistroUf: `${conselho} ${registro} / ${uf}`,
        key: `${conselho}_${registro}_${uf}`
    };
}

export function normalizeCrmAndUf(rawCrm?: string, rawUf?: string, observacoes?: string): { crm: string; uf: string; displayCrmUf: string } | null {
    const res = detectTipoProfissional(rawCrm, rawUf, observacoes);
    if (!res) return null;
    return {
        crm: res.registro,
        uf: res.uf,
        displayCrmUf: res.displayRegistroUf
    };
}

const COLORS = ['#ec4899', '#3b82f6', '#6366f1', '#10b981', '#8b5cf6', '#f59e0b', '#0ea5e9', '#f43f5e'];

const UFS_LIST = [
    'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
    'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN',
    'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'
];

export const MedicosDashboardTab: React.FC<MedicosDashboardTabProps> = ({
    medicamentos,
    movimentacoes,
    onNavigate
}) => {
    // --- ESTADO DE MÉDICOS E PROFISSIONAIS CADASTRADOS ---
    const [medicosCadastrados, setMedicosCadastrados] = useState<Record<string, FarmaciaMedico>>({});

    useEffect(() => {
        const carregarMedicos = async () => {
            try {
                const map = await db.getMedicosCadastrados();
                setMedicosCadastrados(map);
            } catch (e) {
                console.error('[MedicosDashboardTab] Erro ao carregar prescritores cadastrados:', e);
            }
        };

        carregarMedicos();

        const handleMedicosChange = () => carregarMedicos();
        window.addEventListener('farmacia-medicos-changed', handleMedicosChange);
        return () => window.removeEventListener('farmacia-medicos-changed', handleMedicosChange);
    }, []);

    // --- ESTADOS DE FILTROS ---
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTipoProfissional, setSelectedTipoProfissional] = useState<'TODOS' | TipoProfissionalPrescritor>('TODOS');
    const [selectedUf, setSelectedUf] = useState<string>('TODAS');
    const [selectedMed, setSelectedMed] = useState<string>('TODOS');
    const [selectedCategoria, setSelectedCategoria] = useState<'TODAS' | 'CBAF' | 'CESAF' | 'CEAF'>('TODAS');
    const [periodPreset, setPeriodPreset] = useState<'7_days' | '30_days' | '90_days' | 'this_month' | 'this_year' | 'all' | 'custom'>('all');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');

    // --- ESTADO DA TABELA E MODAL ---
    const [sortField, setSortField] = useState<'itens' | 'receitas' | 'fisico' | 'meds' | 'recente' | 'crm' | 'nome' | 'tipo'>('itens');
    const [sortAsc, setSortAsc] = useState(false);
    const [selectedMedico, setSelectedMedico] = useState<NormalizedMedico | null>(null);
    const [medDetailsSearch, setMedDetailsSearch] = useState('');

    // --- FORMULÁRIO DE CADASTRO/EDIÇÃO MANUAL NO MODAL ---
    const [editTipo, setEditTipo] = useState<TipoProfissionalPrescritor>('medico');
    const [editNome, setEditNome] = useState('');
    const [editCrm, setEditCrm] = useState('');
    const [editUf, setEditUf] = useState('MG');
    const [editEspecialidade, setEditEspecialidade] = useState('');
    const [savingMedico, setSavingMedico] = useState(false);
    const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

    // Sincroniza formulário ao selecionar um prescritor
    useEffect(() => {
        if (selectedMedico) {
            const registered = medicosCadastrados[selectedMedico.key] || medicosCadastrados[`${selectedMedico.crm}_${selectedMedico.uf}`];
            const nomeInicial = registered?.nome || selectedMedico.nomeCadastrado || Array.from(selectedMedico.rawNomes)[0] || '';
            setEditTipo(selectedMedico.tipoProfissional || 'medico');
            setEditNome(nomeInicial);
            setEditCrm(selectedMedico.crm);
            setEditUf(selectedMedico.uf);
            setEditEspecialidade(registered?.especialidade || '');
            setSaveSuccessMsg(null);
        }
    }, [selectedMedico, medicosCadastrados]);

    // --- FILTRAGEM TEMPORAL DE MOVIMENTAÇÕES ---
    const dateInterval = useMemo(() => {
        const now = new Date();
        if (periodPreset === '7_days') {
            return { start: subDays(now, 7), end: now };
        }
        if (periodPreset === '30_days') {
            return { start: subDays(now, 30), end: now };
        }
        if (periodPreset === '90_days') {
            return { start: subDays(now, 90), end: now };
        }
        if (periodPreset === 'this_month') {
            return { start: startOfMonth(now), end: endOfMonth(now) };
        }
        if (periodPreset === 'this_year') {
            return { start: startOfYear(now), end: endOfYear(now) };
        }
        if (periodPreset === 'custom' && customStartDate && customEndDate) {
            try {
                const s = parseISO(customStartDate);
                const e = parseISO(`${customEndDate}T23:59:59`);
                return { start: s, end: e };
            } catch {
                return null;
            }
        }
        return null;
    }, [periodPreset, customStartDate, customEndDate]);

    // --- PROCESSAMENTO E NORMALIZAÇÃO DE PROFISSIONAIS PRESCRITORES ---
    const { medicosList, allAvailableUfs, allAvailableMeds, countByTipo } = useMemo(() => {
        const medicosMap: Record<string, NormalizedMedico> = {};
        const ufsSet = new Set<string>();
        const medsSet = new Set<string>();
        const tipoCounters: Record<TipoProfissionalPrescritor, number> = {
            medico: 0,
            enfermeiro: 0,
            dentista: 0,
            farmaceutico: 0,
            psicologo: 0,
            fisioterapeuta: 0
        };

        // Filtra movimentações válidas de saída (dispensação)
        const saidas = movimentacoes.filter(m => {
            const isSaida = m.tipo === 'Saída' || (m.tipo as string) === 'saida';
            return isSaida && m.data;
        });

        saidas.forEach(mov => {
            const explicitTipo = mov.tipo_profissional;
            const explicitConselho = mov.conselho_profissional;
            const norm = detectTipoProfissional(mov.medico_crm, mov.medico_uf, mov.observacoes, explicitTipo, explicitConselho);
            if (!norm) return;

            ufsSet.add(norm.uf);
            if (mov.medicamento_nome) medsSet.add(mov.medicamento_nome.trim());

            // Filtros temporais, de categoria e medicamento
            if (dateInterval) {
                try {
                    const movDate = parseISO(mov.data);
                    if (!isWithinInterval(movDate, dateInterval)) return;
                } catch {
                    return;
                }
            }

            if (selectedCategoria !== 'TODAS' && mov.medicamento_categoria !== selectedCategoria) {
                return;
            }

            if (selectedMed !== 'TODOS' && mov.medicamento_nome && mov.medicamento_nome.trim() !== selectedMed) {
                return;
            }

            if (selectedUf !== 'TODAS' && norm.uf !== selectedUf) {
                return;
            }

            const key = `${norm.conselho}_${norm.registro}_${norm.uf}`;
            const fallbackKey = `${norm.registro}_${norm.uf}`;
            const cadastrado = medicosCadastrados[key] || medicosCadastrados[fallbackKey];
            const nomeCadastrado = cadastrado?.nome || undefined;
            const configProf = PROFISSIONAIS_CONFIG[norm.tipo] || PROFISSIONAIS_CONFIG.medico;
            const fullDisplayName = nomeCadastrado 
                ? `${nomeCadastrado} — ${norm.conselho} ${norm.registro}/${norm.uf}`
                : norm.displayRegistroUf;

            // Identificador de receita/retirada distinta
            const receitaKey = (mov as any).receita_numero || (mov as any).grupo_id || `${norm.conselho}_${norm.registro}_${norm.uf}_${(mov.paciente_cpf || mov.paciente_nome || 'PACIENTE').trim().toLowerCase()}_${(mov.data || '').substring(0, 16)}`;

            if (!medicosMap[key]) {
                medicosMap[key] = {
                    key,
                    tipoProfissional: norm.tipo,
                    conselho: norm.conselho,
                    labelProfissional: configProf.label,
                    crm: norm.registro,
                    registro: norm.registro,
                    uf: norm.uf,
                    nomeCadastrado,
                    displayCrmUf: norm.displayRegistroUf,
                    fullDisplayName,
                    rawCrms: new Set(),
                    rawUfs: new Set(),
                    rawNomes: new Set(),
                    totalReceitas: 0,
                    totalItensEntregues: 0,
                    totalQuantidadeFisica: 0,
                    totalPrescricoes: 0,
                    totalUnidades: 0,
                    medicamentosDistintos: new Set(),
                    receitasSet: new Set(),
                    ultimaPrescricao: mov.data,
                    primeiraPrescricao: mov.data,
                    movimentacoes: [],
                    medsMap: {}
                };
            }

            const target = medicosMap[key];
            if (nomeCadastrado) {
                target.nomeCadastrado = nomeCadastrado;
                target.fullDisplayName = `${nomeCadastrado} — ${norm.conselho} ${norm.registro}/${norm.uf}`;
            }

            if (mov.medico_crm) target.rawCrms.add(mov.medico_crm);
            if (mov.medico_uf) target.rawUfs.add(mov.medico_uf);
            if (mov.medico_nome) target.rawNomes.add(mov.medico_nome);

            // Contabilização de Itens Entregues
            target.totalItensEntregues += 1;
            target.totalQuantidadeFisica += (mov.quantidade || 0);
            target.receitasSet.add(receitaKey);
            target.totalReceitas = target.receitasSet.size;
            
            target.totalPrescricoes = target.totalReceitas;
            target.totalUnidades = target.totalQuantidadeFisica;

            target.movimentacoes.push(mov);

            const medName = (mov.medicamento_nome || 'Medicamento').trim();
            target.medicamentosDistintos.add(medName);

            if (!target.medsMap[medName]) {
                target.medsMap[medName] = {
                    nome: medName,
                    categoria: mov.medicamento_categoria || 'CBAF',
                    totalItens: 0,
                    quantidadeFisica: 0,
                    receitas: new Set(),
                    datas: [],
                    prescricoes: 0,
                    unidades: 0
                };
            }
            target.medsMap[medName].totalItens += 1;
            target.medsMap[medName].quantidadeFisica += (mov.quantidade || 0);
            target.medsMap[medName].receitas.add(receitaKey);
            target.medsMap[medName].datas.push(mov.data);

            target.medsMap[medName].prescricoes = target.medsMap[medName].totalItens;
            target.medsMap[medName].unidades = target.medsMap[medName].quantidadeFisica;

            if (new Date(mov.data) > new Date(target.ultimaPrescricao)) {
                target.ultimaPrescricao = mov.data;
            }
            if (new Date(mov.data) < new Date(target.primeiraPrescricao)) {
                target.primeiraPrescricao = mov.data;
            }
        });

        const list = Object.values(medicosMap);

        list.forEach(m => {
            if (tipoCounters[m.tipoProfissional] !== undefined) {
                tipoCounters[m.tipoProfissional]++;
            }
        });

        return {
            medicosList: list,
            allAvailableUfs: Array.from(ufsSet).sort(),
            allAvailableMeds: Array.from(medsSet).sort(),
            countByTipo: tipoCounters
        };
    }, [movimentacoes, dateInterval, selectedCategoria, selectedMed, selectedUf, medicosCadastrados]);

    // --- FILTRAGEM POR CATEGORIA PROFISSIONAL E TERMO DE BUSCA ---
    const filteredMedicos = useMemo(() => {
        const q = searchTerm.toLowerCase().trim();
        let result = [...medicosList];

        if (selectedTipoProfissional !== 'TODOS') {
            result = result.filter(m => m.tipoProfissional === selectedTipoProfissional);
        }

        if (q) {
            result = result.filter(m => {
                const matchCrm = m.crm.includes(q) || m.registro.includes(q);
                const matchConselho = m.conselho.toLowerCase().includes(q);
                const matchTipo = m.labelProfissional.toLowerCase().includes(q);
                const matchUf = m.uf.toLowerCase().includes(q);
                const matchDisplay = m.displayCrmUf.toLowerCase().includes(q);
                const matchFull = m.fullDisplayName.toLowerCase().includes(q);
                const matchNomeCad = m.nomeCadastrado ? m.nomeCadastrado.toLowerCase().includes(q) : false;
                const matchRawCrm = Array.from(m.rawCrms).some(r => r.toLowerCase().includes(q));
                const matchRawNomes = Array.from(m.rawNomes).some(n => n.toLowerCase().includes(q));
                const matchMeds = Array.from(m.medicamentosDistintos).some(md => md.toLowerCase().includes(q));

                return matchCrm || matchConselho || matchTipo || matchUf || matchDisplay || matchFull || matchNomeCad || matchRawCrm || matchRawNomes || matchMeds;
            });
        }

        // Ordenação
        result.sort((a, b) => {
            let comp = 0;
            if (sortField === 'itens') comp = b.totalItensEntregues - a.totalItensEntregues;
            else if (sortField === 'receitas') comp = b.totalReceitas - a.totalReceitas;
            else if (sortField === 'fisico') comp = b.totalQuantidadeFisica - a.totalQuantidadeFisica;
            else if (sortField === 'meds') comp = b.medicamentosDistintos.size - a.medicamentosDistintos.size;
            else if (sortField === 'crm') comp = Number(a.crm) - Number(b.crm);
            else if (sortField === 'nome') comp = (a.nomeCadastrado || a.crm).localeCompare(b.nomeCadastrado || b.crm);
            else if (sortField === 'tipo') comp = a.labelProfissional.localeCompare(b.labelProfissional);
            else if (sortField === 'recente') comp = new Date(b.ultimaPrescricao).getTime() - new Date(a.ultimaPrescricao).getTime();
            return sortAsc ? -comp : comp;
        });

        return result;
    }, [medicosList, selectedTipoProfissional, searchTerm, sortField, sortAsc]);

    // --- INDICADORES CONSOLIDADOS (KPIS) ---
    const kpis = useMemo(() => {
        const totalMedicos = filteredMedicos.length;

        // Total de receitas distintas
        const allUniqueReceitas = new Set<string>();
        filteredMedicos.forEach(m => {
            m.receitasSet.forEach(r => allUniqueReceitas.add(r));
        });
        const totalReceitas = allUniqueReceitas.size;

        const totalItensEntregues = filteredMedicos.reduce((acc, curr) => acc + curr.totalItensEntregues, 0);
        const totalQuantidadeFisica = filteredMedicos.reduce((acc, curr) => acc + curr.totalQuantidadeFisica, 0);

        const allDistinctMeds = new Set<string>();
        filteredMedicos.forEach(m => {
            m.medicamentosDistintos.forEach(med => allDistinctMeds.add(med));
        });

        const mediaItensPorReceita = totalReceitas > 0 ? (totalItensEntregues / totalReceitas) : 0;

        // Distribuição por Categoria de Profissional Prescritor
        const tipoDistMap: Record<string, { label: string; count: number; itens: number; receitas: Set<string> }> = {};
        LISTA_PROFISSIONAIS_PRESCRITORES.forEach(p => {
            tipoDistMap[p.id] = { label: `${p.label} (${p.conselho})`, count: 0, itens: 0, receitas: new Set() };
        });

        filteredMedicos.forEach(m => {
            if (tipoDistMap[m.tipoProfissional]) {
                tipoDistMap[m.tipoProfissional].count++;
                tipoDistMap[m.tipoProfissional].itens += m.totalItensEntregues;
                m.receitasSet.forEach(r => tipoDistMap[m.tipoProfissional].receitas.add(r));
            }
        });

        const tipoChartData = Object.entries(tipoDistMap)
            .map(([tipo, data]) => ({
                name: data.label,
                tipo,
                value: data.itens,
                profissionais: data.count,
                receitas: data.receitas.size,
                itens: data.itens
            }))
            .filter(d => d.value > 0)
            .sort((a, b) => b.value - a.value);

        // Distribuição por UF
        const ufDistMap: Record<string, { receitas: Set<string>; itens: number; fisico: number }> = {};
        filteredMedicos.forEach(m => {
            if (!ufDistMap[m.uf]) {
                ufDistMap[m.uf] = { receitas: new Set(), itens: 0, fisico: 0 };
            }
            m.receitasSet.forEach(r => ufDistMap[m.uf].receitas.add(r));
            ufDistMap[m.uf].itens += m.totalItensEntregues;
            ufDistMap[m.uf].fisico += m.totalQuantidadeFisica;
        });

        const ufChartData = Object.entries(ufDistMap).map(([uf, data]) => ({
            name: uf,
            value: data.itens,
            receitas: data.receitas.size,
            itens: data.itens,
            fisico: data.fisico
        })).sort((a, b) => b.value - a.value);

        // Top 5 Prescritores
        const top5 = [...filteredMedicos]
            .sort((a, b) => b.totalItensEntregues - a.totalItensEntregues)
            .slice(0, 5)
            .map(m => ({
                name: m.nomeCadastrado ? `${m.nomeCadastrado} (${m.conselho} ${m.crm}/${m.uf})` : `${m.conselho} ${m.crm}/${m.uf}`,
                conselho: m.conselho,
                tipo: m.labelProfissional,
                itens: m.totalItensEntregues,
                receitas: m.totalReceitas,
                fisico: m.totalQuantidadeFisica
            }));

        return {
            totalMedicos,
            totalReceitas,
            totalItensEntregues,
            totalMedsDiferentes: allDistinctMeds.size,
            totalQuantidadeFisica,
            mediaItensPorReceita,
            tipoChartData,
            ufChartData,
            top5,
            totalPrescricoes: totalReceitas,
            totalUnidades: totalQuantidadeFisica,
            mediaPorPrescricao: mediaItensPorReceita
        };
    }, [filteredMedicos]);

    const handleSort = (field: 'itens' | 'receitas' | 'fisico' | 'meds' | 'recente' | 'crm' | 'nome' | 'tipo') => {
        if (sortField === field) {
            setSortAsc(!sortAsc);
        } else {
            setSortField(field);
            setSortAsc(false);
        }
    };

    const clearFilters = () => {
        setSearchTerm('');
        setSelectedTipoProfissional('TODOS');
        setSelectedUf('TODAS');
        setSelectedMed('TODOS');
        setSelectedCategoria('TODAS');
        setPeriodPreset('all');
        setCustomStartDate('');
        setCustomEndDate('');
    };

    const hasActiveFilters = searchTerm || selectedTipoProfissional !== 'TODOS' || selectedUf !== 'TODAS' || selectedMed !== 'TODOS' || selectedCategoria !== 'TODAS' || periodPreset !== 'all';

    // Salvar cadastro manual do profissional no modal
    const handleSaveMedico = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanCrm = editCrm.replace(/\D/g, '').trim();
        const cleanUf = (editUf || 'MG').trim().toUpperCase();
        const cleanNome = editNome.trim();
        const selectedProf = PROFISSIONAIS_CONFIG[editTipo] || PROFISSIONAIS_CONFIG.medico;

        if (!cleanCrm) {
            alert(`Por favor, informe o número do ${selectedProf.conselho}.`);
            return;
        }

        setSavingMedico(true);
        setSaveSuccessMsg(null);

        try {
            const saved = await db.saveMedicoCadastrado({
                crm: cleanCrm,
                uf: cleanUf,
                nome: cleanNome,
                tipo_profissional: editTipo,
                conselho: selectedProf.conselho,
                especialidade: editEspecialidade.trim() || undefined
            });

            const key = `${selectedProf.conselho}_${cleanCrm}_${cleanUf}`;
            setMedicosCadastrados(prev => ({
                ...prev,
                [key]: saved,
                [`${cleanCrm}_${cleanUf}`]: saved
            }));

            // Atualiza selectedMedico se ainda aberto
            if (selectedMedico) {
                setSelectedMedico(prev => prev ? {
                    ...prev,
                    crm: cleanCrm,
                    registro: cleanCrm,
                    uf: cleanUf,
                    conselho: selectedProf.conselho,
                    tipoProfissional: editTipo,
                    labelProfissional: selectedProf.label,
                    nomeCadastrado: cleanNome || undefined,
                    displayCrmUf: `${selectedProf.conselho} ${cleanCrm} / ${cleanUf}`,
                    fullDisplayName: cleanNome ? `${cleanNome} — ${selectedProf.conselho} ${cleanCrm}/${cleanUf}` : `${selectedProf.conselho} ${cleanCrm} / ${cleanUf}`
                } : null);
            }

            setSaveSuccessMsg(`Dados do ${selectedProf.label.toLowerCase()} salvos com sucesso! (${cleanNome ? `${cleanNome} — ${selectedProf.conselho} ${cleanCrm}/${cleanUf}` : `${selectedProf.conselho} ${cleanCrm}/${cleanUf}`})`);
            setTimeout(() => setSaveSuccessMsg(null), 4000);
        } catch (err: any) {
            alert(err.message || 'Erro ao salvar dados do profissional prescritor.');
        } finally {
            setSavingMedico(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300">
            {/* Header & Descrição da Aba */}
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 via-rose-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-pink-500/20 shrink-0">
                        <Stethoscope className="w-7 h-7" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full bg-pink-50 text-pink-700 text-[10px] font-black uppercase tracking-wider border border-pink-200">
                                Gestão de Prescrições & Conselhos
                            </span>
                            <span className="text-[10px] font-bold text-slate-400">
                                Rota: /FarmaciaPopular/Dashboard/VisaoGeral/Medicos
                            </span>
                        </div>
                        <h2 className="text-xl md:text-2xl font-black text-slate-900 uppercase tracking-tight mt-0.5">
                            Painel de Profissionais Prescritores
                        </h2>
                        <p className="text-xs text-slate-500 font-medium">
                            Análise integrada de Médicos (CRM), Enfermeiros (COREN), Dentistas (CRO), Farmacêuticos (CRF), Psicólogos (CRP) e Fisioterapeutas (CREFITO).
                        </p>
                    </div>
                </div>

                {hasActiveFilters && (
                    <button
                        onClick={clearFilters}
                        className="self-start md:self-auto px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Limpar Filtros
                    </button>
                )}
            </div>

            {/* Seletor Rápido de Categorias de Profissionais Prescritores */}
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-100 shadow-sm space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-pink-600" />
                        <span>Filtrar por Conselho / Categoria de Profissional</span>
                    </label>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                        {filteredMedicos.length} profissionais localizados
                    </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                    {/* Botão Todos */}
                    <button
                        type="button"
                        onClick={() => setSelectedTipoProfissional('TODOS')}
                        className={`p-2 sm:p-2.5 rounded-2xl border text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
                            selectedTipoProfissional === 'TODOS'
                                ? 'bg-pink-600 text-white border-pink-700 shadow-md shadow-pink-600/20 ring-2 ring-pink-500/20'
                                : 'bg-slate-50/70 hover:bg-white text-slate-700 border-slate-200/80 hover:border-pink-300'
                        }`}
                    >
                        <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                                selectedTipoProfissional === 'TODOS' ? 'bg-white/20 text-white' : 'bg-pink-100 text-pink-700'
                            }`}>
                                <Users className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                                <span className="block text-[11px] font-black uppercase truncate leading-tight">
                                    Todos
                                </span>
                                <span className={`text-[9px] font-bold truncate block ${selectedTipoProfissional === 'TODOS' ? 'text-pink-100' : 'text-slate-400'}`}>
                                    Conselhos
                                </span>
                            </div>
                        </div>
                        <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-lg shrink-0 ${
                            selectedTipoProfissional === 'TODOS' ? 'bg-white text-pink-700' : 'bg-slate-200/70 text-slate-800'
                        }`}>
                            {medicosList.length}
                        </span>
                    </button>

                    {/* Botões dos 6 Conselhos */}
                    {LISTA_PROFISSIONAIS_PRESCRITORES.map(prof => {
                        const Icon = prof.icon;
                        const isSelected = selectedTipoProfissional === prof.id;
                        const count = countByTipo[prof.id] || 0;

                        return (
                            <button
                                key={prof.id}
                                type="button"
                                onClick={() => setSelectedTipoProfissional(prof.id)}
                                className={`p-2 sm:p-2.5 rounded-2xl border text-left transition-all flex items-center justify-between gap-2 cursor-pointer ${
                                    isSelected
                                        ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white border-pink-700 shadow-md shadow-pink-600/20 ring-2 ring-pink-500/20'
                                        : 'bg-slate-50/70 hover:bg-white text-slate-700 border-slate-200/80 hover:border-pink-300'
                                }`}
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                                        isSelected ? 'bg-white/20 text-white' : 'bg-pink-50 text-pink-600 border border-pink-100'
                                    }`}>
                                        <Icon className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="min-w-0">
                                        <span className="block text-[11px] font-black uppercase truncate leading-tight">
                                            {prof.label}
                                        </span>
                                        <span className={`text-[9px] font-mono font-bold truncate block uppercase ${isSelected ? 'text-pink-100' : 'text-slate-400'}`}>
                                            {prof.conselho}
                                        </span>
                                    </div>
                                </div>
                                <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-lg shrink-0 ${
                                    isSelected ? 'bg-white text-pink-700' : 'bg-slate-200/70 text-slate-800'
                                }`}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Painel de Filtros Avançados */}
            <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4">
                <div className="flex items-center gap-2 text-xs font-black text-slate-400 uppercase tracking-widest pb-2 border-b border-slate-100">
                    <Filter className="w-4 h-4 text-pink-500" />
                    <span>Filtros de Pesquisa & Segmentação</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    {/* Busca Registro / Nome */}
                    <div className="relative">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                            Buscar Profissional ou Registro
                        </label>
                        <div className="relative">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Ex: Nome, CRM, COREN, CRO..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-pink-500 focus:outline-none transition-all"
                            />
                        </div>
                    </div>

                    {/* Filtro por UF */}
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                            Estado (UF do Conselho)
                        </label>
                        <select
                            value={selectedUf}
                            onChange={(e) => setSelectedUf(e.target.value)}
                            className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-pink-500 focus:outline-none transition-all cursor-pointer"
                        >
                            <option value="TODAS">TODAS AS UFs ({allAvailableUfs.length})</option>
                            {allAvailableUfs.map(uf => (
                                <option key={uf} value={uf}>{uf}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filtro por Medicamento */}
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                            Medicamento Prescrito
                        </label>
                        <select
                            value={selectedMed}
                            onChange={(e) => setSelectedMed(e.target.value)}
                            className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-pink-500 focus:outline-none transition-all cursor-pointer"
                        >
                            <option value="TODOS">TODOS OS MEDICAMENTOS</option>
                            {allAvailableMeds.map(med => (
                                <option key={med} value={med}>{med}</option>
                            ))}
                        </select>
                    </div>

                    {/* Filtro por Categoria SUS */}
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                            Categoria SUS
                        </label>
                        <select
                            value={selectedCategoria}
                            onChange={(e) => setSelectedCategoria(e.target.value as any)}
                            className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-pink-500 focus:outline-none transition-all cursor-pointer"
                        >
                            <option value="TODAS">TODAS (CBAF, CESAF, CEAF)</option>
                            <option value="CBAF">CBAF (Básica)</option>
                            <option value="CESAF">CESAF (Estratégico)</option>
                            <option value="CEAF">CEAF (Especializado)</option>
                        </select>
                    </div>

                    {/* Filtro por Período */}
                    <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
                            Período de Dispensação
                        </label>
                        <select
                            value={periodPreset}
                            onChange={(e) => setPeriodPreset(e.target.value as any)}
                            className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-pink-500 focus:outline-none transition-all cursor-pointer"
                        >
                            <option value="all">Todo o Histórico</option>
                            <option value="7_days">Últimos 7 dias</option>
                            <option value="30_days">Últimos 30 dias</option>
                            <option value="90_days">Últimos 90 dias</option>
                            <option value="this_month">Mês Atual</option>
                            <option value="this_year">Ano Atual</option>
                            <option value="custom">Personalizado...</option>
                        </select>
                    </div>
                </div>

                {/* Filtro de Datas Personalizadas */}
                {periodPreset === 'custom' && (
                    <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-3 animate-in fade-in">
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-bold text-slate-500">De:</label>
                            <input
                                type="date"
                                value={customStartDate}
                                onChange={(e) => setCustomStartDate(e.target.value)}
                                className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 bg-white"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-xs font-bold text-slate-500">Até:</label>
                            <input
                                type="date"
                                value={customEndDate}
                                onChange={(e) => setCustomEndDate(e.target.value)}
                                className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 bg-white"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Grid de 6 Indicadores Consolidados (KPIs) */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
                {/* KPI 1: Prescritores Identificados */}
                <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Users className="w-12 h-12 text-pink-600" />
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                        Prescritores Identificados
                    </span>
                    <div className="text-2xl sm:text-3xl font-black text-slate-900">
                        {kpis.totalMedicos}
                        <span className="text-xs font-bold text-slate-400 ml-1">ativos</span>
                    </div>
                    <p className="text-[10px] font-bold text-pink-600 mt-1 uppercase tracking-wider">
                        Conselhos de Saúde
                    </p>
                </div>

                {/* KPI 2: Total de Receitas */}
                <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <FileText className="w-12 h-12 text-indigo-600" />
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                        Total de Receitas
                    </span>
                    <div className="text-2xl sm:text-3xl font-black text-slate-900">
                        {kpis.totalReceitas.toLocaleString('pt-BR')}
                        <span className="text-xs font-bold text-slate-400 ml-1">receitas</span>
                    </div>
                    <p className="text-[10px] font-bold text-indigo-600 mt-1 uppercase tracking-wider">
                        Prescrições Atendidas
                    </p>
                </div>

                {/* KPI 3: Total de Itens Entregues */}
                <div className="bg-white rounded-3xl p-5 border-2 border-emerald-100/80 shadow-sm relative overflow-hidden group bg-gradient-to-br from-white to-emerald-50/20">
                    <div className="absolute top-0 right-0 p-4 opacity-15 group-hover:opacity-25 transition-opacity">
                        <Package className="w-12 h-12 text-emerald-600" />
                    </div>
                    <span className="text-[10px] font-black text-emerald-700 uppercase tracking-widest block mb-1">
                        Total de Itens Entregues
                    </span>
                    <div className="text-2xl sm:text-3xl font-black text-emerald-950">
                        {kpis.totalItensEntregues.toLocaleString('pt-BR')}
                        <span className="text-xs font-bold text-emerald-600 ml-1">itens</span>
                    </div>
                    <p className="text-[10px] font-bold text-emerald-700 mt-1 uppercase tracking-wider flex items-center gap-1">
                        <Check className="w-3 h-3 text-emerald-600" /> 1 por medicamento
                    </p>
                </div>

                {/* KPI 4: Medicamentos Diferentes */}
                <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Pill className="w-12 h-12 text-cyan-600" />
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                        Medicamentos Diferentes
                    </span>
                    <div className="text-2xl sm:text-3xl font-black text-slate-900">
                        {kpis.totalMedsDiferentes}
                        <span className="text-xs font-bold text-slate-400 ml-1">tipos</span>
                    </div>
                    <p className="text-[10px] font-bold text-cyan-600 mt-1 uppercase tracking-wider">
                        Mix de Prescrição
                    </p>
                </div>

                {/* KPI 5: Média de Itens por Receita */}
                <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Activity className="w-12 h-12 text-amber-600" />
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                        Média Itens / Receita
                    </span>
                    <div className="text-2xl sm:text-3xl font-black text-slate-900">
                        {kpis.mediaItensPorReceita.toFixed(1)}
                        <span className="text-xs font-bold text-slate-400 ml-1">itens/rec</span>
                    </div>
                    <p className="text-[10px] font-bold text-amber-600 mt-1 uppercase tracking-wider">
                        Itens por Atendimento
                    </p>
                </div>

                {/* KPI 6: Quantidade Física Dispensada */}
                <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Layers className="w-12 h-12 text-purple-600" />
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                        Qtd Física Dispensada
                    </span>
                    <div className="text-2xl sm:text-3xl font-black text-slate-900">
                        {kpis.totalQuantidadeFisica.toLocaleString('pt-BR')}
                        <span className="text-xs font-bold text-slate-400 ml-1">un</span>
                    </div>
                    <p className="text-[10px] font-bold text-purple-600 mt-1 uppercase tracking-wider">
                        Comprimidos & ml
                    </p>
                </div>
            </div>

            {/* Gráficos Estratégicos */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Gráfico 1: Top 5 Profissionais Prescritores (por Itens Entregues) */}
                <div className="lg:col-span-2 bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                        <div className="flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-pink-600" />
                            <div>
                                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-tight">
                                    Top Prescritores por Itens Entregues
                                </h3>
                                <p className="text-[11px] text-slate-400 font-medium">
                                    Contagem de medicamentos prescritos e dispensados aos pacientes por profissional
                                </p>
                            </div>
                        </div>
                        <span className="text-[10px] font-bold text-pink-600 bg-pink-50 px-2.5 py-1 rounded-full uppercase">
                            Ranking Geral
                        </span>
                    </div>

                    {kpis.top5.length > 0 ? (
                        <div className="h-64 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={kpis.top5} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                    <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                    <YAxis type="category" dataKey="name" tick={{ fill: '#475569', fontSize: 10, fontWeight: 'bold' }} width={160} />
                                    <Tooltip
                                        content={({ active, payload, label }) => {
                                            if (active && payload && payload.length) {
                                                const data = payload[0].payload;
                                                return (
                                                    <div className="bg-white p-3 rounded-2xl shadow-xl border border-slate-200 text-xs">
                                                        <p className="font-extrabold text-slate-900 mb-1">{label} ({data.tipo})</p>
                                                        <p className="text-emerald-600 font-bold">📦 {data.itens.toLocaleString('pt-BR')} itens entregues</p>
                                                        <p className="text-indigo-600 font-bold">📄 {data.receitas.toLocaleString('pt-BR')} receitas atendidas</p>
                                                        <p className="text-slate-400 font-medium text-[11px]">💊 {data.fisico.toLocaleString('pt-BR')} unidades físicas</p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    <Bar dataKey="itens" fill="#ec4899" radius={[0, 8, 8, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center py-12 text-slate-400">
                            <Stethoscope className="w-10 h-10 mb-2 stroke-[1.5] text-slate-300" />
                            <p className="text-xs font-bold uppercase tracking-wider">Nenhum profissional com dispensação no período</p>
                        </div>
                    )}
                </div>

                {/* Gráfico 2: Distribuição por Categoria de Profissional Prescritor */}
                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex flex-col">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                        <div className="flex items-center gap-2">
                            <PieIcon className="w-5 h-5 text-indigo-600" />
                            <div>
                                <h3 className="text-sm font-extrabold text-slate-800 uppercase tracking-tight">
                                    Distribuição por Conselho
                                </h3>
                                <p className="text-[11px] text-slate-400 font-medium">
                                    Volume de itens por categoria
                                </p>
                            </div>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">
                            Conselhos
                        </span>
                    </div>

                    {kpis.tipoChartData.length > 0 ? (
                        <div className="flex-1 flex flex-col justify-between">
                            <div className="h-44 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={kpis.tipoChartData}
                                            dataKey="value"
                                            nameKey="name"
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={45}
                                            outerRadius={65}
                                            paddingAngle={4}
                                        >
                                            {kpis.tipoChartData.map((_, index) => (
                                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            formatter={(val: any, name: string, props: any) => [
                                                `${val.toLocaleString('pt-BR')} itens entregues (${props.payload.profissionais} profissionais, ${props.payload.receitas} receitas)`,
                                                'Volume'
                                            ]}
                                            contentStyle={{ backgroundColor: '#ffffff', borderRadius: '1rem', border: '1px solid #e2e8f0' }}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="grid grid-cols-2 gap-2 mt-2">
                                {kpis.tipoChartData.slice(0, 4).map((entry, idx) => (
                                    <div key={entry.name} className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-100">
                                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                                        <div className="flex-1 min-w-0">
                                            <span className="text-xs font-black text-slate-800 block truncate">{entry.name}</span>
                                            <span className="text-[10px] font-bold text-slate-400 block">{entry.itens} itens ({entry.profissionais} prof.)</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center py-12 text-slate-400">
                            <PieIcon className="w-10 h-10 mb-2 stroke-[1.5] text-slate-300" />
                            <p className="text-xs font-bold uppercase tracking-wider">Sem dados de categorias</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Listagem Dinâmica de Profissionais Prescritores */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h3 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                            <Users className="w-5 h-5 text-pink-600" />
                            Profissionais Prescritores ({filteredMedicos.length})
                        </h3>
                        <p className="text-xs text-slate-500 font-medium">
                            Clique em um profissional para visualizar o raio-x de prescrições, receitas vinculadas e cadastrar/editar os dados.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Ordenar por:</span>
                        <div className="flex flex-wrap bg-slate-100 p-1 rounded-xl gap-1">
                            <button
                                onClick={() => handleSort('itens')}
                                className={`px-2.5 py-1 text-[10px] font-black rounded-lg transition-all ${sortField === 'itens' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
                            >
                                Itens Entregues
                            </button>
                            <button
                                onClick={() => handleSort('receitas')}
                                className={`px-2.5 py-1 text-[10px] font-black rounded-lg transition-all ${sortField === 'receitas' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
                            >
                                Receitas
                            </button>
                            <button
                                onClick={() => handleSort('tipo')}
                                className={`px-2.5 py-1 text-[10px] font-black rounded-lg transition-all ${sortField === 'tipo' ? 'bg-white text-pink-600 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
                            >
                                Conselho
                            </button>
                            <button
                                onClick={() => handleSort('nome')}
                                className={`px-2.5 py-1 text-[10px] font-black rounded-lg transition-all ${sortField === 'nome' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
                            >
                                Nome
                            </button>
                            <button
                                onClick={() => handleSort('fisico')}
                                className={`px-2.5 py-1 text-[10px] font-black rounded-lg transition-all ${sortField === 'fisico' ? 'bg-white text-purple-600 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
                            >
                                Qtd Física
                            </button>
                            <button
                                onClick={() => handleSort('recente')}
                                className={`px-2.5 py-1 text-[10px] font-black rounded-lg transition-all ${sortField === 'recente' ? 'bg-white text-blue-600 shadow-xs' : 'text-slate-500 hover:text-slate-900'}`}
                            >
                                Recente
                            </button>
                        </div>
                    </div>
                </div>

                {filteredMedicos.length > 0 ? (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50/75 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                                    <th className="py-3.5 px-6">Profissional / Conselho & Registro</th>
                                    <th className="py-3.5 px-6 text-center">Total de Receitas</th>
                                    <th className="py-3.5 px-6 text-center">Itens Entregues</th>
                                    <th className="py-3.5 px-6 text-center">Medicamentos Diferentes</th>
                                    <th className="py-3.5 px-6 text-center">Quantidade Física</th>
                                    <th className="py-3.5 px-6">Última Prescrição Registrada</th>
                                    <th className="py-3.5 px-6 text-right">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                                {filteredMedicos.map((medico) => {
                                    const formattedLastDate = medico.ultimaPrescricao ? format(parseISO(medico.ultimaPrescricao), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : 'N/A';
                                    const profConfig = PROFISSIONAIS_CONFIG[medico.tipoProfissional] || PROFISSIONAIS_CONFIG.medico;
                                    const Icon = profConfig.icon;

                                    return (
                                        <tr
                                            key={medico.key}
                                            onClick={() => setSelectedMedico(medico)}
                                            className="hover:bg-pink-50/30 transition-colors cursor-pointer group"
                                        >
                                            {/* Nome / Conselho / Registro / UF */}
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-10 h-10 rounded-xl ${profConfig.badgeBg} ${profConfig.badgeText} border ${profConfig.badgeBorder} font-black text-xs flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:bg-pink-600 group-hover:text-white transition-all shadow-xs`}>
                                                        <Icon className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        {medico.nomeCadastrado ? (
                                                            <>
                                                                <span className="font-extrabold text-slate-900 text-sm block">
                                                                    {medico.nomeCadastrado}
                                                                </span>
                                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                                    <span className={`px-2 py-0.5 rounded-md ${profConfig.badgeBg} ${profConfig.badgeText} border ${profConfig.badgeBorder} text-[10px] font-black uppercase font-mono`}>
                                                                        {medico.conselho} {medico.crm}/{medico.uf}
                                                                    </span>
                                                                    <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[9px] font-bold uppercase">
                                                                        {profConfig.label}
                                                                    </span>
                                                                    <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
                                                                        <UserCheck className="w-3 h-3" /> Cadastrado
                                                                    </span>
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="font-extrabold text-slate-900 text-sm font-mono">
                                                                        {medico.conselho} {medico.crm}
                                                                    </span>
                                                                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-black uppercase font-mono">
                                                                        {medico.uf}
                                                                    </span>
                                                                    <span className={`px-1.5 py-0.5 rounded-md ${profConfig.badgeBg} ${profConfig.badgeText} border ${profConfig.badgeBorder} text-[9px] font-bold uppercase`}>
                                                                        {profConfig.label}
                                                                    </span>
                                                                </div>
                                                                <span className="text-[10px] font-bold text-pink-500 hover:underline block mt-0.5">
                                                                    + Cadastrar nome do {profConfig.label.toLowerCase()}
                                                                </span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Receitas */}
                                            <td className="py-4 px-6 text-center">
                                                <span className="inline-flex items-center px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 font-extrabold text-xs">
                                                    {medico.totalReceitas} receitas
                                                </span>
                                            </td>

                                            {/* Total de Itens Entregues */}
                                            <td className="py-4 px-6 text-center">
                                                <span className="inline-flex items-center px-3.5 py-1 rounded-full bg-emerald-50 text-emerald-700 font-black text-xs border border-emerald-200">
                                                    {medico.totalItensEntregues} itens
                                                </span>
                                            </td>

                                            {/* Medicamentos Diferentes */}
                                            <td className="py-4 px-6 text-center">
                                                <span className="inline-flex items-center px-3 py-1 rounded-full bg-cyan-50 text-cyan-700 font-extrabold text-xs">
                                                    {medico.medicamentosDistintos.size} tipos
                                                </span>
                                            </td>

                                            {/* Quantidade Física Dispensada */}
                                            <td className="py-4 px-6 text-center">
                                                <div className="font-bold text-slate-700 text-xs">
                                                    {medico.totalQuantidadeFisica.toLocaleString('pt-BR')}
                                                    <span className="text-[10px] font-normal text-slate-400 ml-1">un</span>
                                                </div>
                                            </td>

                                            {/* Última Prescrição */}
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-1.5 text-slate-500 font-medium text-xs">
                                                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                                                    <span>{formattedLastDate}</span>
                                                </div>
                                            </td>

                                            {/* Ação */}
                                            <td className="py-4 px-6 text-right">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedMedico(medico);
                                                    }}
                                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-pink-50 hover:bg-pink-600 text-pink-700 hover:text-white font-extrabold text-xs uppercase tracking-wider transition-all shadow-xs cursor-pointer"
                                                >
                                                    <Edit3 className="w-3.5 h-3.5" />
                                                    <span>Detalhes</span>
                                                    <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-12 text-center">
                        <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                            <Stethoscope className="w-7 h-7" />
                        </div>
                        <h4 className="text-base font-extrabold text-slate-800 uppercase tracking-tight">
                            Nenhum profissional prescritor encontrado
                        </h4>
                        <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 font-medium">
                            Não encontramos registros de dispensação correspondentes aos filtros selecionados.
                        </p>
                        {hasActiveFilters && (
                            <button
                                onClick={clearFilters}
                                className="mt-4 px-4 py-2 bg-pink-600 text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-pink-700 transition-all shadow-md shadow-pink-500/20 cursor-pointer"
                            >
                                Limpar Todos os Filtros
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* MODAL DETALHADO E DE EDIÇÃO DO PRESCRITOR SELECIONADO */}
            {selectedMedico && (
                <div className="fixed inset-0 z-[999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh] my-auto animate-in zoom-in-95 duration-200">
                        {/* Header do Modal */}
                        <div className="px-6 py-5 bg-gradient-to-r from-pink-600 via-rose-600 to-indigo-700 text-white flex items-center justify-between gap-4 shrink-0 shadow-md">
                            <div className="flex items-center gap-3.5">
                                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white ring-4 ring-white/10 shadow-inner shrink-0">
                                    {React.createElement(PROFISSIONAIS_CONFIG[selectedMedico.tipoProfissional]?.icon || Stethoscope, { className: 'w-6 h-6' })}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-lg sm:text-xl font-black uppercase tracking-tight">
                                            {selectedMedico.nomeCadastrado ? `${selectedMedico.nomeCadastrado} — ${selectedMedico.displayCrmUf}` : selectedMedico.displayCrmUf}
                                        </h3>
                                        <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-black uppercase">
                                            {selectedMedico.labelProfissional}
                                        </span>
                                    </div>
                                    <p className="text-xs text-pink-100 font-medium">
                                        Cadastro de profissional, auditoria analítica e histórico de dispensações vinculadas
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={() => setSelectedMedico(null)}
                                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition-all cursor-pointer"
                                title="Fechar"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Corpo com Scroll */}
                        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6 flex-1 min-h-0 bg-slate-50/40">
                            {/* BLOCO DE CADASTRO / EDIÇÃO MANUAL DO PROFISSIONAL */}
                            <form onSubmit={handleSaveMedico} className="bg-white rounded-2xl p-5 border-2 border-pink-100 shadow-sm space-y-4">
                                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                                    <div className="flex items-center gap-2">
                                        <Edit3 className="w-4 h-4 text-pink-600" />
                                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                                            Identificação & Cadastro do Profissional Prescritor
                                        </h4>
                                    </div>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                                        Conselho: {PROFISSIONAIS_CONFIG[editTipo]?.conselho} + UF
                                    </span>
                                </div>

                                {/* Seletor de Categoria do Profissional no Formulário */}
                                <div>
                                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1.5">
                                        Categoria / Conselho Profissional *
                                    </label>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                                        {LISTA_PROFISSIONAIS_PRESCRITORES.map(prof => {
                                            const Icon = prof.icon;
                                            const isSelected = editTipo === prof.id;
                                            return (
                                                <button
                                                    key={prof.id}
                                                    type="button"
                                                    onClick={() => setEditTipo(prof.id)}
                                                    className={`p-2 rounded-xl border text-left transition-all flex items-center justify-between gap-1.5 cursor-pointer ${
                                                        isSelected
                                                            ? 'bg-pink-50 border-pink-500 shadow-xs ring-2 ring-pink-500/20'
                                                            : 'bg-slate-50/70 hover:bg-white border-slate-200 text-slate-600'
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
                                                            isSelected ? 'bg-pink-600 text-white' : 'bg-slate-200/70 text-slate-700'
                                                        }`}>
                                                            <Icon className="w-3.5 h-3.5" />
                                                        </div>
                                                        <span className={`text-[10px] font-black uppercase truncate ${isSelected ? 'text-pink-900' : 'text-slate-800'}`}>
                                                            {prof.label}
                                                        </span>
                                                    </div>
                                                    <span className={`text-[8px] font-mono font-black px-1.5 py-0.2 rounded uppercase ${
                                                        isSelected ? 'bg-pink-600 text-white' : 'bg-slate-200 text-slate-700'
                                                    }`}>
                                                        {prof.conselho}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                                    {/* Nome Completo */}
                                    <div className="md:col-span-6">
                                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1">
                                            Nome Completo do {PROFISSIONAIS_CONFIG[editTipo]?.label} *
                                        </label>
                                        <input
                                            type="text"
                                            placeholder={`Ex: Dr.(a) Nome do ${PROFISSIONAIS_CONFIG[editTipo]?.label}`}
                                            value={editNome}
                                            onChange={(e) => setEditNome(e.target.value)}
                                            className="w-full px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-pink-500 focus:outline-none transition-all shadow-inner"
                                            required
                                        />
                                    </div>

                                    {/* Registro no Conselho */}
                                    <div className="md:col-span-3">
                                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1">
                                            Número do {PROFISSIONAIS_CONFIG[editTipo]?.conselho} *
                                        </label>
                                        <input
                                            type="text"
                                            value={editCrm}
                                            onChange={(e) => setEditCrm(e.target.value.replace(/\D/g, ''))}
                                            className="w-full px-3.5 py-2 text-xs font-mono font-bold rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-pink-500 focus:outline-none transition-all shadow-inner"
                                            required
                                        />
                                    </div>

                                    {/* UF */}
                                    <div className="md:col-span-3">
                                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-700 mb-1">
                                            UF do {PROFISSIONAIS_CONFIG[editTipo]?.conselho} *
                                        </label>
                                        <select
                                            value={editUf}
                                            onChange={(e) => setEditUf(e.target.value)}
                                            className="w-full px-3.5 py-2 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-pink-500 focus:outline-none transition-all cursor-pointer shadow-inner"
                                        >
                                            {UFS_LIST.map(uf => (
                                                <option key={uf} value={uf}>{uf}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-1">
                                    <p className="text-[11px] text-slate-400 font-medium">
                                        💡 O nome e conselho salvos serão associados automaticamente a todas as dispensações e relatórios deste registro.
                                    </p>

                                    <button
                                        type="submit"
                                        disabled={savingMedico}
                                        className="px-5 py-2 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-pink-500/20 active:scale-95 flex items-center gap-2 cursor-pointer shrink-0 disabled:opacity-50"
                                    >
                                        {savingMedico ? (
                                            <>Salvando...</>
                                        ) : (
                                            <>
                                                <Save className="w-3.5 h-3.5" />
                                                Salvar Identificação do Profissional
                                            </>
                                        )}
                                    </button>
                                </div>

                                {saveSuccessMsg && (
                                    <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2 animate-in fade-in">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                        <span>{saveSuccessMsg}</span>
                                    </div>
                                )}
                            </form>

                            {/* Cards de Resumo do Prescritor */}
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                                <div className="bg-white p-4 rounded-2xl border border-slate-200/70 shadow-xs">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-0.5">Total Receitas</span>
                                    <div className="text-xl font-black text-indigo-700">{selectedMedico.totalReceitas}</div>
                                </div>
                                <div className="bg-white p-4 rounded-2xl border-2 border-emerald-100 bg-emerald-50/20 shadow-xs">
                                    <span className="text-[9px] font-black text-emerald-700 uppercase tracking-wider block mb-0.5">Itens Entregues</span>
                                    <div className="text-xl font-black text-emerald-800">{selectedMedico.totalItensEntregues} <span className="text-[10px] font-bold text-emerald-600">itens</span></div>
                                </div>
                                <div className="bg-white p-4 rounded-2xl border border-slate-200/70 shadow-xs">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-0.5">Meds Diferentes</span>
                                    <div className="text-xl font-black text-slate-900">{selectedMedico.medicamentosDistintos.size}</div>
                                </div>
                                <div className="bg-white p-4 rounded-2xl border border-slate-200/70 shadow-xs">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-0.5">Média / Receita</span>
                                    <div className="text-xl font-black text-slate-900">
                                        {(selectedMedico.totalItensEntregues / Math.max(1, selectedMedico.totalReceitas)).toFixed(1)} <span className="text-[10px] font-bold text-slate-400">itens</span>
                                    </div>
                                </div>
                                <div className="bg-white p-4 rounded-2xl border border-slate-200/70 shadow-xs col-span-2 sm:col-span-1">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-0.5">Qtd Física (un)</span>
                                    <div className="text-xl font-black text-slate-700">{selectedMedico.totalQuantidadeFisica.toLocaleString('pt-BR')} <span className="text-[10px] font-bold text-slate-400">un</span></div>
                                </div>
                            </div>

                            {/* Detalhe dos Medicamentos Prescritos */}
                            <div className="bg-white rounded-2xl p-5 border border-slate-200/70 shadow-xs space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                                    <div>
                                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                                            <Pill className="w-4 h-4 text-pink-600" />
                                            Medicamentos Prescritos por este Profissional ({Object.keys(selectedMedico.medsMap).length})
                                        </h4>
                                        <p className="text-[11px] text-slate-400 font-medium">
                                            Quantidade de itens prescritos nas receitas e total físico dispensado
                                        </p>
                                    </div>

                                    <div className="relative w-full sm:w-64">
                                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                        <input
                                            type="text"
                                            placeholder="Filtrar medicamento..."
                                            value={medDetailsSearch}
                                            onChange={(e) => setMedDetailsSearch(e.target.value)}
                                            className="w-full pl-8 pr-2.5 py-1.5 text-xs font-bold rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="divide-y divide-slate-100">
                                    {Object.values(selectedMedico.medsMap)
                                        .filter(med => !medDetailsSearch || med.nome.toLowerCase().includes(medDetailsSearch.toLowerCase()))
                                        .sort((a, b) => b.totalItens - a.totalItens)
                                        .map((med) => {
                                            const pct = selectedMedico.totalItensEntregues > 0 ? (med.totalItens / selectedMedico.totalItensEntregues) * 100 : 0;

                                            return (
                                                <div key={med.nome} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 group hover:bg-slate-50/80 px-2 rounded-xl transition-all">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="font-black text-slate-900 text-sm">
                                                                {med.nome}
                                                            </span>
                                                            <span className="px-2 py-0.5 rounded-md bg-pink-50 text-pink-700 text-[9px] font-black uppercase">
                                                                {med.categoria}
                                                            </span>
                                                        </div>

                                                        {/* Barra de Proporção */}
                                                        <div className="w-full max-w-md bg-slate-100 h-2 rounded-full overflow-hidden mt-1.5">
                                                            <div
                                                                className="bg-gradient-to-r from-emerald-500 to-teal-600 h-full rounded-full transition-all duration-500"
                                                                style={{ width: `${Math.min(100, Math.max(5, pct))}%` }}
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Resultados Exatos */}
                                                    <div className="flex items-center gap-3 text-right shrink-0">
                                                        <div className="bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-100 text-center min-w-[120px]">
                                                            <span className="text-[10px] font-black text-emerald-600 uppercase block">Itens Entregues</span>
                                                            <span className="text-xs font-black text-emerald-800">→ {med.totalItens} itens</span>
                                                        </div>

                                                        <div className="bg-indigo-50 px-3 py-1.5 rounded-xl border border-indigo-100 text-center min-w-[110px]">
                                                            <span className="text-[10px] font-black text-indigo-500 uppercase block">Receitas</span>
                                                            <span className="text-xs font-black text-indigo-700">→ {med.receitas.size} rec</span>
                                                        </div>

                                                        <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-center min-w-[120px]">
                                                            <span className="text-[10px] font-black text-slate-400 uppercase block">Qtd Física</span>
                                                            <span className="text-xs font-bold text-slate-700">→ {med.quantidadeFisica.toLocaleString('pt-BR')} un</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>

                            {/* Histórico Cronológico de Dispensações */}
                            <div className="bg-white rounded-2xl p-5 border border-slate-200/70 shadow-xs space-y-3">
                                <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                                    <Clock className="w-4 h-4 text-indigo-600" />
                                    Histórico Cronológico de Retiradas ({selectedMedico.movimentacoes.length} itens)
                                </h4>

                                <div className="overflow-x-auto max-h-60 custom-scrollbar border border-slate-100 rounded-xl">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead className="sticky top-0 bg-slate-100 text-[9px] font-black text-slate-500 uppercase">
                                            <tr>
                                                <th className="py-2.5 px-3">Data / Hora</th>
                                                <th className="py-2.5 px-3">Paciente</th>
                                                <th className="py-2.5 px-3">Medicamento</th>
                                                <th className="py-2.5 px-3 text-center">Qtd Física</th>
                                                <th className="py-2.5 px-3">Lote</th>
                                                <th className="py-2.5 px-3">Atendente</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                                            {selectedMedico.movimentacoes.map((m) => (
                                                <tr key={m.id} className="hover:bg-slate-50">
                                                    <td className="py-2 px-3 whitespace-nowrap text-slate-500 font-mono text-[11px]">
                                                        {m.data ? format(parseISO(m.data), "dd/MM/yyyy HH:mm", { locale: ptBR }) : '-'}
                                                    </td>
                                                    <td className="py-2 px-3 font-bold text-slate-900">
                                                        {m.paciente_nome || 'Não informado'}
                                                    </td>
                                                    <td className="py-2 px-3 font-medium">
                                                        {m.medicamento_nome}
                                                    </td>
                                                    <td className="py-2 px-3 text-center font-bold text-pink-600">
                                                        {m.quantidade}
                                                    </td>
                                                    <td className="py-2 px-3 text-slate-500 font-mono text-[10px]">
                                                        {m.lote || 'S/L'}
                                                    </td>
                                                    <td className="py-2 px-3 text-slate-500 text-[11px]">
                                                        {m.responsavel_nome || '-'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* Informações de Auditoria e Normalização */}
                            <div className="bg-slate-100/80 rounded-2xl p-4 border border-slate-200 text-[11px] text-slate-600 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div>
                                    <span className="font-bold text-slate-800 block">Valores Originais Registrados para Auditoria:</span>
                                    <span className="text-slate-500 text-[10px]">
                                        Conselho: {selectedMedico.conselho} ({selectedMedico.labelProfissional}) | 
                                        Registros gravados nas receitas: {Array.from(selectedMedico.rawCrms).join(', ') || selectedMedico.crm} | 
                                        UFs: {Array.from(selectedMedico.rawUfs).join(', ') || selectedMedico.uf}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                                    <span className="text-[10px] font-black text-emerald-700 uppercase">Validação Integrada SUS</span>
                                </div>
                            </div>
                        </div>

                        {/* Rodapé do Modal */}
                        <div className="px-6 py-4 bg-white border-t border-slate-100 flex justify-end gap-3 shrink-0">
                            <button
                                type="button"
                                onClick={() => setSelectedMedico(null)}
                                className="px-5 py-2.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-extrabold text-xs uppercase tracking-wider transition-all cursor-pointer"
                            >
                                Fechar Visualização
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
