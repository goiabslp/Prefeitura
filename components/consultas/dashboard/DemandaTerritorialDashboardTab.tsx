import React, { useState, useMemo } from 'react';
import {
  Building2,
  Globe,
  MapPin,
  TrendingUp,
  Activity,
  CheckCircle2,
  Clock,
  Calendar,
  Layers,
  ArrowUpRight,
  Sparkles,
  Search,
  Filter,
  Users,
  ShieldCheck,
  Hospital,
  FileText
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid
} from 'recharts';
import { MetricasDemandaTerritorial } from '../../../services/consultasAnalyticsService';

interface DemandaTerritorialDashboardTabProps {
  demanda: MetricasDemandaTerritorial;
  isMockData?: boolean;
}

export const DemandaTerritorialDashboardTab: React.FC<DemandaTerritorialDashboardTabProps> = ({
  demanda,
  isMockData
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'geral' | 'interna' | 'externa' | 'municipios' | 'prestadores'>('geral');
  const [searchTerm, setSearchTerm] = useState('');

  // Dados para o Gráfico de Donut: Demanda Interna vs Externa
  const pieData = useMemo(() => {
    return [
      {
        name: 'Demanda Interna (Própria)',
        value: demanda.interna.total,
        percentual: demanda.interna.percentual,
        color: '#10B981' // Emerald
      },
      {
        name: 'Demanda Externa (Consórcios/Rede)',
        value: demanda.externa.total,
        percentual: demanda.externa.percentual,
        color: '#0284C7' // Sky
      }
    ];
  }, [demanda]);

  // Dados comparativos das etapas do fluxo
  const fluxoComparativoData = useMemo(() => {
    return [
      {
        etapa: 'Aguardando Fila',
        Interna: demanda.interna.pacientesAguardando,
        Externa: demanda.externa.pacientesAguardando
      },
      {
        etapa: 'Vagas Liberadas',
        Interna: demanda.interna.vagasLiberadas,
        Externa: demanda.externa.vagasLiberadas
      },
      {
        etapa: 'Agendados',
        Interna: demanda.interna.pacientesAgendados,
        Externa: demanda.externa.pacientesAgendados
      },
      {
        etapa: 'Realizados',
        Interna: demanda.interna.atendimentosRealizados,
        Externa: demanda.externa.atendimentosRealizados
      }
    ];
  }, [demanda]);

  // Filtro de busca para municípios e prestadores
  const filteredMunicipios = useMemo(() => {
    if (!searchTerm.trim()) return demanda.externa.porMunicipio;
    const clean = searchTerm.toLowerCase().trim();
    return demanda.externa.porMunicipio.filter(m =>
      m.municipio.toLowerCase().includes(clean) ||
      m.prestadores.some(p => p.toLowerCase().includes(clean))
    );
  }, [demanda.externa.porMunicipio, searchTerm]);

  const filteredPrestadores = useMemo(() => {
    if (!searchTerm.trim()) return demanda.externa.porPrestador;
    const clean = searchTerm.toLowerCase().trim();
    return demanda.externa.porPrestador.filter(p =>
      p.prestador.toLowerCase().includes(clean) ||
      p.municipio.toLowerCase().includes(clean) ||
      p.convenio.toLowerCase().includes(clean)
    );
  }, [demanda.externa.porPrestador, searchTerm]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* 1. BANNER EXECUTIVO DE DEMANDA TERRITORIAL */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 p-6 rounded-3xl text-white shadow-xl border border-slate-700/50 flex flex-col lg:flex-row items-center justify-between gap-6">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-sky-500/20 text-sky-300 border border-sky-400/30 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" /> Capacidade Territorial & Absorção Municipal
            </span>
            {isMockData && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[10px] font-black uppercase">
                Projeção
              </span>
            )}
          </div>
          <h2 className="text-2xl font-black tracking-tight text-white">
            Demanda Territorial: Interna vs. Externa
          </h2>
          <p className="text-xs text-slate-300 leading-relaxed font-medium">
            Visão estratégica da capacidade do município em absorver sua própria demanda de saúde versus o volume dependente de pactuações, convênios e consórcios intermunicipais (ex: CISAMAPI, hospitais regionais).
          </p>
        </div>

        {/* Resumo Executivo em Cards Flutuantes */}
        <div className="grid grid-cols-3 gap-3 w-full lg:w-auto shrink-0">
          
          {/* Demanda Total */}
          <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl border border-white/15 text-center min-w-[120px]">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-300 block">Demanda Total</span>
            <span className="text-2xl font-black text-white block mt-1">{demanda.demandaTotal}</span>
            <span className="text-[9px] font-bold text-slate-400">100% dos registros</span>
          </div>

          {/* Interna */}
          <div className="p-4 bg-emerald-500/15 backdrop-blur-md rounded-2xl border border-emerald-400/30 text-center min-w-[125px]">
            <div className="flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-300">
              <Building2 className="w-3 h-3" /> Interna
            </div>
            <span className="text-2xl font-black text-emerald-300 block mt-1">{demanda.interna.total}</span>
            <span className="text-[10px] font-black text-emerald-200 bg-emerald-500/30 px-2 py-0.5 rounded-full">
              {demanda.interna.percentual}% absorção
            </span>
          </div>

          {/* Externa */}
          <div className="p-4 bg-sky-500/15 backdrop-blur-md rounded-2xl border border-sky-400/30 text-center min-w-[125px]">
            <div className="flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-wider text-sky-300">
              <Globe className="w-3 h-3" /> Externa
            </div>
            <span className="text-2xl font-black text-sky-300 block mt-1">{demanda.externa.total}</span>
            <span className="text-[10px] font-black text-sky-200 bg-sky-500/30 px-2 py-0.5 rounded-full">
              {demanda.externa.percentual}% externa
            </span>
          </div>

        </div>
      </div>

      {/* 2. SUB-ABAS DE NAVEGAÇÃO DA VISÃO TERRITORIAL */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {[
            { id: 'geral', label: 'Visão Geral Comparativa', icon: Layers },
            { id: 'interna', label: `Demanda Interna (${demanda.interna.total})`, icon: Building2 },
            { id: 'externa', label: `Demanda Externa (${demanda.externa.total})`, icon: Globe },
            { id: 'municipios', label: `Por Município (${demanda.externa.porMunicipio.length})`, icon: MapPin },
            { id: 'prestadores', label: `Por Prestador (${demanda.externa.porPrestador.length})`, icon: Hospital }
          ].map(tab => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {(activeSubTab === 'municipios' || activeSubTab === 'prestadores') && (
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filtrar por nome ou cidade..."
              className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-bold text-slate-800 placeholder:text-slate-400 outline-none focus:border-sky-500"
            />
          </div>
        )}
      </div>

      {/* 3. CONTEÚDO DAS SUB-ABAS */}

      {/* === SUB-ABA: GERAL COMPARATIVA === */}
      {activeSubTab === 'geral' && (
        <div className="space-y-6">
          
          {/* Grid de Gráficos Comparativos */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Gráfico 1: Distribuição Percentual de Demanda (Donut) */}
            <div className="lg:col-span-5 p-5 bg-white rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                    Distribuição da Demanda
                  </h3>
                  <span className="text-[10px] font-bold text-slate-400">Interna vs. Externa</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Proporção de absorção interna pelo município versus rede conveniada externa.
                </p>
              </div>

              <div className="h-64 my-2 flex items-center justify-center relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={95}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: number, name: string) => [
                        `${val} solicitações (${((val / (demanda.demandaTotal || 1)) * 100).toFixed(1)}%)`,
                        name
                      ]}
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px', fontWeight: 'bold' }}
                    />
                    <Legend verticalAlign="bottom" height={36} iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
                  <span className="text-[10px] font-black uppercase text-emerald-800 block">Capacidade Própria</span>
                  <span className="text-lg font-black text-emerald-950">{demanda.interna.total}</span>
                  <span className="text-[9px] font-bold text-emerald-700 block">{demanda.interna.percentual}% da demanda</span>
                </div>
                <div className="p-2.5 bg-sky-50 rounded-xl border border-sky-100 text-center">
                  <span className="text-[10px] font-black uppercase text-sky-800 block">Dependência Externa</span>
                  <span className="text-lg font-black text-sky-950">{demanda.externa.total}</span>
                  <span className="text-[9px] font-bold text-sky-700 block">{demanda.externa.percentual}% da demanda</span>
                </div>
              </div>
            </div>

            {/* Gráfico 2: Fluxo Comparativo nas Etapas da Regulação */}
            <div className="lg:col-span-7 p-5 bg-white rounded-3xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide">
                    Fluxo da Regulação por Tipo Territorial
                  </h3>
                  <span className="text-[10px] font-bold text-slate-400">Comparativo de Etapas</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Pacientes aguardando, vagas liberadas, agendamentos e atendimentos realizados.
                </p>
              </div>

              <div className="h-64 my-2">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={fluxoComparativoData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="etapa" tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px', fontWeight: 'bold' }}
                    />
                    <Legend verticalAlign="top" align="right" height={36} iconType="circle" />
                    <Bar dataKey="Interna" fill="#10B981" radius={[6, 6, 0, 0]} name="Demanda Interna" />
                    <Bar dataKey="Externa" fill="#0284C7" radius={[6, 6, 0, 0]} name="Demanda Externa" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-4 gap-2 pt-3 border-t border-slate-100 text-center">
                <div className="p-2 bg-slate-50 rounded-xl">
                  <span className="text-[9px] font-bold uppercase text-slate-400 block">Fila Espera</span>
                  <span className="text-xs font-black text-slate-800">
                    {demanda.interna.pacientesAguardando + demanda.externa.pacientesAguardando}
                  </span>
                </div>
                <div className="p-2 bg-slate-50 rounded-xl">
                  <span className="text-[9px] font-bold uppercase text-slate-400 block">Vagas Livres</span>
                  <span className="text-xs font-black text-slate-800">
                    {demanda.interna.vagasLiberadas + demanda.externa.vagasLiberadas}
                  </span>
                </div>
                <div className="p-2 bg-slate-50 rounded-xl">
                  <span className="text-[9px] font-bold uppercase text-slate-400 block">Agendados</span>
                  <span className="text-xs font-black text-slate-800">
                    {demanda.interna.pacientesAgendados + demanda.externa.pacientesAgendados}
                  </span>
                </div>
                <div className="p-2 bg-slate-50 rounded-xl">
                  <span className="text-[9px] font-bold uppercase text-slate-400 block">Realizados</span>
                  <span className="text-xs font-black text-slate-800">
                    {demanda.interna.atendimentosRealizados + demanda.externa.atendimentosRealizados}
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* Cards Detalhados Lado a Lado: Indicadores de Demanda Interna vs Externa */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Bloco Interno */}
            <div className="p-5 bg-gradient-to-br from-emerald-50/50 via-white to-slate-50 rounded-3xl border border-emerald-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-emerald-100">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-emerald-950 uppercase">Demanda Interna</h4>
                    <p className="text-[11px] font-semibold text-emerald-700">Dentro do Município (Centro de Saúde / Policlínica)</p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-600 text-white font-black text-xs">
                  {demanda.interna.percentual}% ({demanda.interna.total})
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-white rounded-xl border border-emerald-100 shadow-2xs">
                  <span className="text-[9px] font-bold uppercase text-slate-400 block">Aguardando Fila</span>
                  <span className="text-lg font-black text-slate-800">{demanda.interna.pacientesAguardando}</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-emerald-100 shadow-2xs">
                  <span className="text-[9px] font-bold uppercase text-slate-400 block">Vagas Liberadas</span>
                  <span className="text-lg font-black text-emerald-700">{demanda.interna.vagasLiberadas}</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-emerald-100 shadow-2xs">
                  <span className="text-[9px] font-bold uppercase text-slate-400 block">Agendados</span>
                  <span className="text-lg font-black text-indigo-700">{demanda.interna.pacientesAgendados}</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-emerald-100 shadow-2xs">
                  <span className="text-[9px] font-bold uppercase text-slate-400 block">Realizados</span>
                  <span className="text-lg font-black text-emerald-700">{demanda.interna.atendimentosRealizados}</span>
                </div>
              </div>

              {/* Top Procedimentos Internos */}
              <div className="space-y-2 pt-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                  Procedimentos mais demandados internamente:
                </span>
                <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                  {demanda.interna.procedimentosMaisDemandados.slice(0, 5).map(proc => (
                    <div key={proc.id} className="p-2.5 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between text-xs">
                      <div className="min-w-0 flex-1 pr-2">
                        <span className="font-extrabold text-slate-800 truncate block">{proc.nome}</span>
                        <span className="text-[10px] text-slate-400">{proc.tipo} • {proc.aguardando} na fila • {proc.liberadas} vagas</span>
                      </div>
                      <span className="px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-mono font-black text-xs shrink-0">
                        {proc.total} sol.
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bloco Externo */}
            <div className="p-5 bg-gradient-to-br from-sky-50/50 via-white to-slate-50 rounded-3xl border border-sky-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-sky-100">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-sky-100 text-sky-700 rounded-xl">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-sky-950 uppercase">Demanda Externa</h4>
                    <p className="text-[11px] font-semibold text-sky-700">Convênios, Consórcios (CISAMAPI), Hospitais fora</p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full bg-sky-600 text-white font-black text-xs">
                  {demanda.externa.percentual}% ({demanda.externa.total})
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 bg-white rounded-xl border border-sky-100 shadow-2xs">
                  <span className="text-[9px] font-bold uppercase text-slate-400 block">Aguardando Fila</span>
                  <span className="text-lg font-black text-slate-800">{demanda.externa.pacientesAguardando}</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-sky-100 shadow-2xs">
                  <span className="text-[9px] font-bold uppercase text-slate-400 block">Vagas Liberadas</span>
                  <span className="text-lg font-black text-sky-700">{demanda.externa.vagasLiberadas}</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-sky-100 shadow-2xs">
                  <span className="text-[9px] font-bold uppercase text-slate-400 block">Agendados</span>
                  <span className="text-lg font-black text-indigo-700">{demanda.externa.pacientesAgendados}</span>
                </div>
                <div className="p-3 bg-white rounded-xl border border-sky-100 shadow-2xs">
                  <span className="text-[9px] font-bold uppercase text-slate-400 block">Realizados</span>
                  <span className="text-lg font-black text-emerald-700">{demanda.externa.atendimentosRealizados}</span>
                </div>
              </div>

              {/* Top Procedimentos Externos */}
              <div className="space-y-2 pt-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                  Procedimentos mais demandados na rede externa:
                </span>
                <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                  {demanda.externa.procedimentosMaisDemandados.slice(0, 5).map(proc => (
                    <div key={proc.id} className="p-2.5 bg-white rounded-xl border border-slate-200/80 flex items-center justify-between text-xs">
                      <div className="min-w-0 flex-1 pr-2">
                        <span className="font-extrabold text-slate-800 truncate block">{proc.nome}</span>
                        <span className="text-[10px] text-slate-400">{proc.tipo} • {proc.aguardando} na fila • {proc.liberadas} vagas</span>
                      </div>
                      <span className="px-2 py-1 rounded-lg bg-sky-50 text-sky-700 font-mono font-black text-xs shrink-0">
                        {proc.total} sol.
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* === SUB-ABA: DEMANDA INTERNA DETALHADA === */}
      {activeSubTab === 'interna' && (
        <div className="space-y-4">
          <div className="p-5 bg-white rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase">
                  Todos os Procedimentos de Demanda Interna
                </h3>
                <p className="text-xs text-slate-500">
                  Profissionais e especialidades que atendem na rede própria municipal.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 font-black text-xs">
                {demanda.interna.total} registros ({demanda.interna.percentual}%)
              </span>
            </div>

            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-wider">
                    <th className="py-3 px-3">Procedimento / Especialidade</th>
                    <th className="py-3 px-3">Tipo</th>
                    <th className="py-3 px-3 text-center">Total Solicitado</th>
                    <th className="py-3 px-3 text-center">Aguardando Fila</th>
                    <th className="py-3 px-3 text-center">Vagas Liberadas</th>
                    <th className="py-3 px-3 text-center">Agendados</th>
                    <th className="py-3 px-3 text-center">Realizados</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {demanda.interna.procedimentosMaisDemandados.map(proc => (
                    <tr key={proc.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 font-extrabold text-slate-900">{proc.nome}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                          {proc.tipo}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-black text-slate-900">{proc.total}</td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-amber-700">{proc.aguardando}</td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-emerald-700">{proc.liberadas}</td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-indigo-700">{proc.agendados}</td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-emerald-700">{proc.realizados}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* === SUB-ABA: DEMANDA EXTERNA DETALHADA === */}
      {activeSubTab === 'externa' && (
        <div className="space-y-4">
          <div className="p-5 bg-white rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase">
                  Todos os Procedimentos de Demanda Externa
                </h3>
                <p className="text-xs text-slate-500">
                  Encaminhamentos pactuados, consórcios e hospitais parceiros fora do município.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-sky-100 text-sky-800 font-black text-xs">
                {demanda.externa.total} registros ({demanda.externa.percentual}%)
              </span>
            </div>

            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-wider">
                    <th className="py-3 px-3">Procedimento / Especialidade</th>
                    <th className="py-3 px-3">Tipo</th>
                    <th className="py-3 px-3 text-center">Total Solicitado</th>
                    <th className="py-3 px-3 text-center">Aguardando Fila</th>
                    <th className="py-3 px-3 text-center">Vagas Liberadas</th>
                    <th className="py-3 px-3 text-center">Agendados</th>
                    <th className="py-3 px-3 text-center">Realizados</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {demanda.externa.procedimentosMaisDemandados.map(proc => (
                    <tr key={proc.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 font-extrabold text-slate-900">{proc.nome}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold">
                          {proc.tipo}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-black text-slate-900">{proc.total}</td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-amber-700">{proc.aguardando}</td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-sky-700">{proc.liberadas}</td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-indigo-700">{proc.agendados}</td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-emerald-700">{proc.realizados}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* === SUB-ABA: POR MUNICÍPIO === */}
      {activeSubTab === 'municipios' && (
        <div className="space-y-4">
          <div className="p-5 bg-white rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase">
                  Distribuição Territorial por Município de Atendimento
                </h3>
                <p className="text-xs text-slate-500">
                  Cidades onde os pacientes de São José do Goiabal realizam suas consultas e exames externos.
                </p>
              </div>
              <span className="text-xs font-bold text-slate-500">
                {filteredMunicipios.length} município(s) listado(s)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredMunicipios.map(m => (
                <div key={m.municipio} className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3 shadow-2xs hover:border-sky-300 transition-all">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                        <MapPin className="w-4 h-4 text-sky-600 shrink-0" />
                        {m.municipio}
                      </span>
                      <span className="text-[10px] text-slate-500 block mt-0.5">
                        {m.prestadores.join(', ') || 'Prestadores Regionais'}
                      </span>
                    </div>
                    <span className="px-2.5 py-1 rounded-xl bg-sky-100 text-sky-800 font-mono font-black text-xs shrink-0">
                      {m.total} sol.
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-1.5 text-center pt-2 border-t border-slate-200/60">
                    <div className="p-1.5 bg-white rounded-lg border border-slate-200/60">
                      <span className="text-[8px] font-bold uppercase text-slate-400 block">Fila</span>
                      <span className="text-xs font-black text-amber-700">{m.aguardando}</span>
                    </div>
                    <div className="p-1.5 bg-white rounded-lg border border-slate-200/60">
                      <span className="text-[8px] font-bold uppercase text-slate-400 block">Vagas</span>
                      <span className="text-xs font-black text-sky-700">{m.liberadas}</span>
                    </div>
                    <div className="p-1.5 bg-white rounded-lg border border-slate-200/60">
                      <span className="text-[8px] font-bold uppercase text-slate-400 block">Agend.</span>
                      <span className="text-xs font-black text-indigo-700">{m.agendados}</span>
                    </div>
                    <div className="p-1.5 bg-white rounded-lg border border-slate-200/60">
                      <span className="text-[8px] font-bold uppercase text-slate-400 block">Realiz.</span>
                      <span className="text-xs font-black text-emerald-700">{m.realizados}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* === SUB-ABA: POR PRESTADOR === */}
      {activeSubTab === 'prestadores' && (
        <div className="space-y-4">
          <div className="p-5 bg-white rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase">
                  Prestadores, Consórcios e Hospitais Parceiros
                </h3>
                <p className="text-xs text-slate-500">
                  Desempenho por entidade executante (CISAMAPI, hospitais, clínicas parceiras).
                </p>
              </div>
              <span className="text-xs font-bold text-slate-500">
                {filteredPrestadores.length} prestador(es)
              </span>
            </div>

            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-[10px] font-black uppercase tracking-wider">
                    <th className="py-3 px-3">Prestador / Hospital</th>
                    <th className="py-3 px-3">Município</th>
                    <th className="py-3 px-3">Convênio / Consórcio</th>
                    <th className="py-3 px-3 text-center">Total</th>
                    <th className="py-3 px-3 text-center">Fila</th>
                    <th className="py-3 px-3 text-center">Vagas</th>
                    <th className="py-3 px-3 text-center">Agendados</th>
                    <th className="py-3 px-3 text-center">Realizados</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-700">
                  {filteredPrestadores.map((p, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3 font-extrabold text-slate-900 flex items-center gap-1.5">
                        <Hospital className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                        {p.prestador}
                      </td>
                      <td className="py-3 px-3 text-slate-600">{p.municipio}</td>
                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                          {p.convenio}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-black text-slate-900">{p.total}</td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-amber-700">{p.aguardando}</td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-sky-700">{p.liberadas}</td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-indigo-700">{p.agendados}</td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-emerald-700">{p.realizados}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
