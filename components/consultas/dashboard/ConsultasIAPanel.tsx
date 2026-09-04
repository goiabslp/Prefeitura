import React, { useState } from 'react';
import {
  MetricasIAPredicoes,
  PrevisaoFilaProcedimento,
  AlertaPreditivoIA
} from '../../../services/consultasAnalyticsService';
import {
  Brain,
  Sparkles,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Calendar,
  Zap,
  Sliders,
  ShieldAlert,
  ArrowRight,
  Info,
  Copy,
  Check,
  ChevronRight,
  Stethoscope,
  Activity
} from 'lucide-react';

interface ConsultasIAPanelProps {
  iaData: MetricasIAPredicoes;
  onSelectProcedimento?: (procedimentoId: string) => void;
}

export const ConsultasIAPanel: React.FC<ConsultasIAPanelProps> = ({
  iaData,
  onSelectProcedimento
}) => {
  const [copiado, setCopiado] = useState(false);

  // Estados do Simulador de Alocação de Vagas
  const [simProcId, setSimProcId] = useState<string>(
    iaData.previsoesFilas[0]?.id || ''
  );
  const [vagasAdicionais, setVagasAdicionais] = useState<number>(15);

  const selectedSimProc = iaData.previsoesFilas.find(p => p.id === simProcId) || iaData.previsoesFilas[0];

  // Cálculo da simulação em tempo real
  const simulacaoResultado = (() => {
    if (!selectedSimProc) return null;
    const filaAtual = selectedSimProc.pacientesFila;
    const vazaoBase = selectedSimProc.vazaoMediaDia;
    // Vagas adicionais diluídas no mês (22 dias úteis)
    const vazaoSimulada = vazaoBase + (vagasAdicionais / 22);
    const diasAtuais = selectedSimProc.diasParaZerar;
    const diasSimulados = filaAtual === 0 ? 0 : Math.ceil(filaAtual / vazaoSimulada);
    const diasEconomizados = Math.max(0, diasAtuais - diasSimulados);
    const percReducao = diasAtuais > 0 ? Number(((diasEconomizados / diasAtuais) * 100).toFixed(0)) : 0;

    const dataEstimadaSim = new Date();
    dataEstimadaSim.setDate(dataEstimadaSim.getDate() + diasSimulados);
    const dataSimStr = `${String(dataEstimadaSim.getDate()).padStart(2, '0')}/${String(dataEstimadaSim.getMonth() + 1).padStart(2, '0')}/${dataEstimadaSim.getFullYear()}`;

    return {
      diasAtuais,
      diasSimulados,
      diasEconomizados,
      percReducao,
      dataSimStr
    };
  })();

  const handleCopiarParecer = () => {
    const texto = `PARECER TÉCNICO DA REGULAÇÃO MUNICIPAL (IA PREDITIVA)
Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}
Score Geral: ${iaData.scoreRegulacao}/100 (${iaData.classificacaoScore})

RESUMO EXECUTIVO:
${iaData.parecerTecnicoIA.resumoExecutivo}

PONTOS FORTES:
${iaData.parecerTecnicoIA.pontosFortes.map(p => `- ${p}`).join('\n')}

PONTOS CRÍTICOS:
${iaData.parecerTecnicoIA.pontosCriticos.map(p => `- ${p}`).join('\n')}

RECOMENDAÇÕES ESTRATÉGICAS:
${iaData.parecerTecnicoIA.recomendacoesEstrategicas.map(r => `- ${r}`).join('\n')}
`;
    navigator.clipboard.writeText(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2500);
  };

  const getBadgeCor = (classificacao: string) => {
    switch (classificacao) {
      case 'Excelente':
        return 'bg-emerald-500 text-white shadow-emerald-500/30';
      case 'Bom':
        return 'bg-sky-500 text-white shadow-sky-500/30';
      case 'Atenção':
        return 'bg-amber-500 text-white shadow-amber-500/30';
      default:
        return 'bg-rose-500 text-white shadow-rose-500/30';
    }
  };

  const getRiscoBadge = (risco: string) => {
    switch (risco) {
      case 'Crítico':
        return 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse';
      case 'Alto':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Médio':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      default:
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* 1. TOPO: SCORE DE REGULAÇÃO & PILARES */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        
        {/* Card do Score Geral */}
        <div className="lg:col-span-4 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-3xl shadow-xl shadow-indigo-950/20 flex flex-col justify-between relative overflow-hidden border border-indigo-800/40">
          <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />

          <div>
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15">
                <Brain className="w-3.5 h-3.5 text-indigo-300" />
                <span className="text-[10px] font-black uppercase tracking-widest text-indigo-200">
                  Diagnóstico por IA
                </span>
              </div>
              <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-md ${getBadgeCor(iaData.classificacaoScore)}`}>
                {iaData.classificacaoScore}
              </span>
            </div>

            <h3 className="text-xl font-extrabold tracking-tight text-white mb-1">
              Saúde da Regulação
            </h3>
            <p className="text-xs text-slate-300 font-medium">
              Avaliação algorítmica contínua de prazos, filas, cotas e absenteísmo.
            </p>
          </div>

          <div className="my-6 flex items-center justify-center">
            {/* Visual Gauge Circle */}
            <div className="relative w-44 h-44 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  className="text-slate-800"
                  strokeWidth="8"
                  stroke="currentColor"
                  fill="transparent"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  className={
                    iaData.scoreRegulacao >= 85
                      ? 'text-emerald-400'
                      : iaData.scoreRegulacao >= 70
                      ? 'text-sky-400'
                      : iaData.scoreRegulacao >= 50
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }
                  strokeWidth="8"
                  strokeDasharray={`${(iaData.scoreRegulacao / 100) * 251.2} 251.2`}
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="transparent"
                  style={{ transition: 'stroke-dasharray 1s ease-in-out' }}
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-4xl font-black tracking-tight text-white">
                  {iaData.scoreRegulacao}
                </span>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  de 100 pts
                </span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-300">
            <span className="flex items-center gap-1.5 font-medium">
              <Activity className="w-3.5 h-3.5 text-sky-400" />
              Projeção 30 dias:
            </span>
            <span className="font-bold text-white">
              ~{iaData.projecaoProximos30Dias.novasSolicitacoesEstimadas} novos pedidos
            </span>
          </div>
        </div>

        {/* Breakdown dos 4 Pilares de Avaliação */}
        <div className="lg:col-span-8 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-600" /> Pilares de Performance da Regulação
                </h4>
                <p className="text-xs text-slate-500 font-medium">
                  Composição do diagnóstico com base em indicadores oficiais do SUS municipal
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              {iaData.pilares.map((pilar, idx) => {
                const perc = Math.round((pilar.score / pilar.max) * 100);
                return (
                  <div key={idx} className="p-4 rounded-2xl bg-slate-50/80 border border-slate-100 hover:border-slate-200 transition-all flex flex-col justify-between">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black text-slate-800 tracking-tight">
                        {pilar.nome}
                      </span>
                      <span className="text-xs font-black text-indigo-600">
                        {pilar.score}/{pilar.max} <span className="text-[9px] text-slate-400 font-normal">pts</span>
                      </span>
                    </div>

                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden my-2">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          perc >= 80 ? 'bg-emerald-500' : perc >= 60 ? 'bg-sky-500' : perc >= 40 ? 'bg-amber-500' : 'bg-rose-500'
                        }`}
                        style={{ width: `${perc}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                      <span className="truncate pr-2 font-medium">{pilar.detalhe}</span>
                      <span className={`px-2 py-0.5 rounded-full font-bold uppercase shrink-0 text-[8px] ${
                        pilar.status === 'Excelente' ? 'bg-emerald-100 text-emerald-700' :
                        pilar.status === 'Bom' ? 'bg-sky-100 text-sky-700' :
                        pilar.status === 'Atenção' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'
                      }`}>
                        {pilar.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-5 p-3.5 bg-indigo-50/60 border border-indigo-100 rounded-2xl flex items-center justify-between gap-3 text-xs text-indigo-900">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-indigo-600 shrink-0" />
              <span>
                <strong>Balanço de Vagas:</strong> Necessárias ~<strong>{iaData.projecaoProximos30Dias.vagasNecessariasParaEstabilidade} vagas</strong> nos próximos 30 dias para manter a fila em equilíbrio.
              </span>
            </div>
            {iaData.projecaoProximos30Dias.deficitVagasProjetado > 0 && (
              <span className="px-2.5 py-1 bg-rose-100 text-rose-700 rounded-lg text-[10px] font-black uppercase shrink-0 border border-rose-200">
                Déficit: {iaData.projecaoProximos30Dias.deficitVagasProjetado} vagas
              </span>
            )}
          </div>
        </div>

      </div>

      {/* 2. PREVISÃO DE TÉRMINO DA FILA (BURN-DOWN FORECASTING) */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
          <div>
            <h4 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" /> Previsão de Prazos & Tempo para Zerar Fila por Procedimento
            </h4>
            <p className="text-xs text-slate-500 font-medium">
              Cálculo preditivo baseado no fluxo histórico de liberação de horários vs fila represada
            </p>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/60 shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Normal (&lt;12d)
            <span className="w-2 h-2 rounded-full bg-amber-500 ml-2" /> Médio (13-25d)
            <span className="w-2 h-2 rounded-full bg-rose-500 ml-2" /> Crítico (&gt;25d)
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-400 bg-slate-50/50">
                <th className="py-3 px-3">Procedimento / Especialidade</th>
                <th className="py-3 px-3 text-center">Fila Atual</th>
                <th className="py-3 px-3 text-center">Especiais na Fila</th>
                <th className="py-3 px-3 text-center">Vazão Média/Dia</th>
                <th className="py-3 px-3 text-center">Previsão Conclusão</th>
                <th className="py-3 px-3 text-center">Data Projetada</th>
                <th className="py-3 px-3 text-center">Risco</th>
                <th className="py-3 px-3">Recomendação Estratégica da IA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {iaData.previsoesFilas.map((item) => (
                <tr
                  key={item.id}
                  className="hover:bg-indigo-50/30 transition-colors group cursor-pointer"
                  onClick={() => onSelectProcedimento && onSelectProcedimento(item.id)}
                >
                  <td className="py-3.5 px-3">
                    <div className="font-extrabold text-slate-800 group-hover:text-indigo-600 transition-colors">
                      {item.nome}
                    </div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                      {item.tipo}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-black text-xs ${
                      item.pacientesFila > 15 ? 'bg-rose-100 text-rose-700' :
                      item.pacientesFila > 5 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'
                    }`}>
                      {item.pacientesFila}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-center">
                    {item.pacientesEspeciais > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-black text-xs bg-rose-50 text-rose-600 border border-rose-200">
                        <Sparkles className="w-3 h-3 text-rose-500" /> {item.pacientesEspeciais}
                      </span>
                    ) : (
                      <span className="text-slate-300 font-bold text-xs">-</span>
                    )}
                  </td>
                  <td className="py-3.5 px-3 text-center font-bold text-slate-600">
                    {item.vazaoMediaDia} /dia
                  </td>
                  <td className="py-3.5 px-3 text-center font-black text-slate-800 text-sm">
                    {item.diasParaZerar === 0 ? (
                      <span className="text-emerald-600">0 dias</span>
                    ) : (
                      <span>{item.diasParaZerar} dias</span>
                    )}
                  </td>
                  <td className="py-3.5 px-3 text-center text-xs font-bold text-slate-600">
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 rounded-lg">
                      <Calendar className="w-3 h-3 text-slate-400" /> {item.dataEstimadaConclusao}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-center">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full font-black text-[9px] uppercase tracking-wider border ${getRiscoBadge(item.nivelRisco)}`}>
                      {item.nivelRisco}
                    </span>
                  </td>
                  <td className="py-3.5 px-3 text-[11px] text-slate-600 max-w-xs">
                    {item.recomendacaoIA}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. SIMULADOR DE ALOCAÇÃO DE VAGAS & IMPACTO NA FILA */}
      <div className="bg-gradient-to-br from-indigo-50/60 via-white to-sky-50/50 p-6 rounded-3xl border border-indigo-100 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/30">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-sm font-black uppercase tracking-wider text-slate-800">
              Simulador Preditivo de Vagas & Desafogamento de Filas
            </h4>
            <p className="text-xs text-slate-500 font-medium">
              Simule o impacto de contratação ou liberação de cotas adicionais sobre o tempo de espera
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-5 items-center">
          
          {/* Controles da Simulação */}
          <div className="lg:col-span-7 space-y-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                Selecione o Procedimento / Exame para Simulação:
              </label>
              <select
                value={simProcId}
                onChange={e => setSimProcId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                {iaData.previsoesFilas.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.nome} (Fila atual: {p.pacientesFila} pacientes | {p.diasParaZerar} dias p/ zerar)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  Adicionar Vagas Extras no Mês:
                </label>
                <span className="text-sm font-black text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-100">
                  +{vagasAdicionais} vagas
                </span>
              </div>
              <input
                type="range"
                min="5"
                max="80"
                step="5"
                value={vagasAdicionais}
                onChange={e => setVagasAdicionais(Number(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
              />
              <div className="flex justify-between text-[9px] font-bold text-slate-400 mt-1">
                <span>+5 vagas</span>
                <span>+25 vagas</span>
                <span>+50 vagas</span>
                <span>+80 vagas</span>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
              {[10, 20, 30, 50].map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVagasAdicionais(v)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                    vagasAdicionais === v
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  +{v} vagas
                </button>
              ))}
            </div>
          </div>

          {/* Resultado Projetado da Simulação */}
          <div className="lg:col-span-5 bg-gradient-to-br from-indigo-900 to-indigo-950 text-white p-5 rounded-2xl shadow-md border border-indigo-800/60 flex flex-col justify-between min-h-[220px]">
            <div>
              <span className="text-[9px] font-black uppercase tracking-widest text-indigo-300 block mb-1">
                Impacto Projetado pela IA
              </span>
              <h5 className="text-base font-extrabold text-white truncate mb-4">
                {selectedSimProc?.nome}
              </h5>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-white/10 rounded-xl backdrop-blur-sm border border-white/10">
                  <span className="text-[9px] font-black uppercase text-indigo-200 block mb-1">Tempo Atual</span>
                  <span className="text-xl font-black text-rose-300 line-through">
                    {simulacaoResultado?.diasAtuais} dias
                  </span>
                </div>

                <div className="p-3 bg-emerald-500/20 rounded-xl backdrop-blur-sm border border-emerald-400/30">
                  <span className="text-[9px] font-black uppercase text-emerald-200 block mb-1">Com +{vagasAdicionais} Vagas</span>
                  <span className="text-2xl font-black text-emerald-300">
                    {simulacaoResultado?.diasSimulados} dias
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-white/15 flex items-center justify-between text-xs">
              <span className="text-indigo-200 font-medium">Redução de Espera:</span>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-400 text-slate-900 font-black text-xs">
                -{simulacaoResultado?.diasEconomizados} dias (-{simulacaoResultado?.percReducao}%)
              </span>
            </div>
          </div>

        </div>
      </div>

      {/* 4. FEED DE ALERTAS PREDITIVOS & ANOMALIAS */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-600" /> Alertas Preditivos & Anomalias de Demanda
            </h4>
            <p className="text-xs text-slate-500 font-medium">
              Situações que requerem intervenção preventiva para evitar desassistência ao cidadão
            </p>
          </div>
          <span className="px-3 py-1 bg-slate-100 rounded-full text-xs font-bold text-slate-600 border border-slate-200/60">
            {iaData.alertasPreditivos.length} alertas ativos
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {iaData.alertasPreditivos.map((alerta) => (
            <div
              key={alerta.id}
              className={`p-5 rounded-2xl border transition-all shadow-xs flex flex-col justify-between ${
                alerta.tipo === 'critico'
                  ? 'bg-rose-50/70 border-rose-200/80 text-rose-950'
                  : alerta.tipo === 'alerta'
                  ? 'bg-amber-50/70 border-amber-200/80 text-amber-950'
                  : alerta.tipo === 'sucesso'
                  ? 'bg-emerald-50/70 border-emerald-200/80 text-emerald-950'
                  : 'bg-sky-50/70 border-sky-200/80 text-sky-950'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    {alerta.tipo === 'critico' && <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}
                    {alerta.tipo === 'alerta' && <Clock className="w-4 h-4 text-amber-600 shrink-0" />}
                    {alerta.tipo === 'sucesso' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />}
                    {alerta.tipo === 'oportunidade' && <Zap className="w-4 h-4 text-sky-600 shrink-0" />}
                    <h5 className="font-extrabold text-xs tracking-tight uppercase">
                      {alerta.titulo}
                    </h5>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                    alerta.tipo === 'critico' ? 'bg-rose-200/80 text-rose-800' :
                    alerta.tipo === 'alerta' ? 'bg-amber-200/80 text-amber-800' :
                    alerta.tipo === 'sucesso' ? 'bg-emerald-200/80 text-emerald-800' : 'bg-sky-200/80 text-sky-800'
                  }`}>
                    {alerta.tipo}
                  </span>
                </div>

                <p className="text-xs text-slate-600 font-medium leading-relaxed mb-3">
                  {alerta.descricao}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-200/60 text-[11px] space-y-1">
                <div className="flex items-start gap-1.5 text-slate-700">
                  <strong className="shrink-0 text-slate-900">Ação Recomendada:</strong>
                  <span>{alerta.acaoSugerida}</span>
                </div>
                <div className="flex items-start gap-1.5 text-slate-500 text-[10px]">
                  <strong className="shrink-0 text-slate-700">Impacto Estimado:</strong>
                  <span>{alerta.impactoEstimado}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 5. PARECER TÉCNICO FORMAL DA IA */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h4 className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
              <Brain className="w-4 h-4 text-indigo-600" /> Parecer Executivo de Regulação & Tomada de Decisão
            </h4>
            <p className="text-xs text-slate-500 font-medium">
              Documento gerado automaticamente para subsídio de reuniões da Secretaria de Saúde e Gabinete
            </p>
          </div>
          <button
            onClick={handleCopiarParecer}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 self-start sm:self-auto cursor-pointer"
          >
            {copiado ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copiado ? 'Copiado para Área de Transferência!' : 'Copiar Parecer Técnico'}
          </button>
        </div>

        <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/60 text-xs font-medium text-slate-700 leading-relaxed">
          {iaData.parecerTecnicoIA.resumoExecutivo}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {/* Pontos Fortes */}
          <div className="p-4 rounded-2xl bg-emerald-50/50 border border-emerald-100">
            <h6 className="text-xs font-black uppercase tracking-wider text-emerald-800 mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Pontos Fortes
            </h6>
            <ul className="space-y-1.5 text-xs text-emerald-950 font-medium">
              {iaData.parecerTecnicoIA.pontosFortes.map((p, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="text-emerald-500 font-bold">•</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Pontos Críticos */}
          <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-100">
            <h6 className="text-xs font-black uppercase tracking-wider text-rose-800 mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Atenção & Gargalos
            </h6>
            <ul className="space-y-1.5 text-xs text-rose-950 font-medium">
              {iaData.parecerTecnicoIA.pontosCriticos.map((p, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="text-rose-500 font-bold">•</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Recomendações Estratégicas */}
          <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100">
            <h6 className="text-xs font-black uppercase tracking-wider text-indigo-800 mb-2 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-indigo-600" /> Ações Prioritárias
            </h6>
            <ul className="space-y-1.5 text-xs text-indigo-950 font-medium">
              {iaData.parecerTecnicoIA.recomendacoesEstrategicas.map((r, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="text-indigo-500 font-bold">•</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

    </div>
  );
};
