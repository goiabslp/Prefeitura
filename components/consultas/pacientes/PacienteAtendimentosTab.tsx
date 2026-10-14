import React, { useState } from 'react';
import {
  Ticket, Clock, Building2, CheckCircle2, AlertCircle, XCircle, RotateCcw,
  Play, Calendar, Search, Filter, ArrowUpRight
} from 'lucide-react';
import { AutoSenhaItem } from '../../../types';
import { formatarDuracaoSegundos } from '../../../services/autoSenhaService';

interface PacienteAtendimentosTabProps {
  senhas: AutoSenhaItem[];
  loading?: boolean;
}

export const PacienteAtendimentosTab: React.FC<PacienteAtendimentosTabProps> = ({
  senhas = [],
  loading = false
}) => {
  const [filtroUnidade, setFiltroUnidade] = useState<string>('TODAS');
  const [filtroStatus, setFiltroStatus] = useState<string>('TODOS');
  const [termoBusca, setTermoBusca] = useState('');
  const [senhaSelecionada, setSenhaSelecionada] = useState<AutoSenhaItem | null>(null);

  // Cálculos consolidados dos atendimentos do paciente
  const metricas = React.useMemo(() => {
    const total = senhas.length;
    const concluidos = senhas.filter(s => s.status === 'CONCLUIDO').length;
    const upa = senhas.filter(s => s.unidade_id === 'upa').length;
    const psf1 = senhas.filter(s => s.unidade_id === 'psf1').length;
    const psf2 = senhas.filter(s => s.unidade_id === 'psf2').length;
    const ausentes = senhas.filter(s => s.status === 'NAO_COMPARECEU').length;
    const cancelados = senhas.filter(s => s.status === 'CANCELADO').length;

    const temposEspera = senhas
      .filter(s => s.wait_time_first_call_seconds && s.wait_time_first_call_seconds > 0)
      .map(s => s.wait_time_first_call_seconds!);
    const mediaEsperaSeg = temposEspera.length > 0 ? Math.round(temposEspera.reduce((a, b) => a + b, 0) / temposEspera.length) : 0;

    const temposAtendimento = senhas
      .filter(s => s.service_duration_seconds && s.service_duration_seconds > 0)
      .map(s => s.service_duration_seconds!);
    const mediaAtendimentoSeg = temposAtendimento.length > 0 ? Math.round(temposAtendimento.reduce((a, b) => a + b, 0) / temposAtendimento.length) : 0;

    const ultima = senhas[0];

    return {
      total,
      concluidos,
      upa,
      psf1,
      psf2,
      ausentes,
      cancelados,
      mediaEsperaSeg,
      mediaAtendimentoSeg,
      ultimaPassagem: ultima ? `${new Date(ultima.created_at).toLocaleDateString('pt-BR')} (${ultima.unidade_id.toUpperCase()})` : 'Nenhuma'
    };
  }, [senhas]);

  const senhasFiltradas = React.useMemo(() => {
    return senhas.filter(s => {
      if (filtroUnidade !== 'TODAS' && s.unidade_id !== filtroUnidade) return false;
      if (filtroStatus !== 'TODOS' && s.status !== filtroStatus) return false;
      if (termoBusca.trim()) {
        const termo = termoBusca.toLowerCase();
        const numMatch = s.numero.toLowerCase().includes(termo);
        const catMatch = (s.prioridade_categoria || '').toLowerCase().includes(termo);
        const guicheMatch = (s.guiche || '').toLowerCase().includes(termo);
        return numMatch || catMatch || guicheMatch;
      }
      return true;
    });
  }, [senhas, filtroUnidade, filtroStatus, termoBusca]);

  const getUnidadeBadge = (unidadeId: string) => {
    switch (unidadeId) {
      case 'upa':
        return { label: 'UPA', bg: 'bg-rose-100 text-rose-800 border-rose-200' };
      case 'psf1':
        return { label: 'PSF 1', bg: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
      case 'psf2':
        return { label: 'PSF 2', bg: 'bg-teal-100 text-teal-800 border-teal-200' };
      default:
        return { label: unidadeId.toUpperCase(), bg: 'bg-slate-100 text-slate-800 border-slate-200' };
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONCLUIDO':
        return { label: 'Concluído', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'EM_ATENDIMENTO':
        return { label: 'Em Atendimento', bg: 'bg-sky-50 text-sky-700 border-sky-200' };
      case 'CHAMANDO':
        return { label: 'Chamando', bg: 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse' };
      case 'NAO_COMPARECEU':
        return { label: 'Não Compareceu', bg: 'bg-slate-100 text-slate-700 border-slate-200' };
      case 'CANCELADO':
        return { label: 'Cancelado', bg: 'bg-rose-50 text-rose-700 border-rose-200' };
      default:
        return { label: 'Aguardando', bg: 'bg-slate-100 text-slate-600 border-slate-200' };
    }
  };

  return (
    <div className="space-y-3 animate-in fade-in duration-150">
      {/* 1. INDICADORES DO CIDADÃO NO AUTOSENHA */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        <div className="bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-2xs">
          <span className="text-[9px] font-black uppercase text-slate-400 block">Total Senhas</span>
          <span className="text-lg font-black text-slate-900 font-mono">{metricas.total}</span>
        </div>
        <div className="bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-2xs">
          <span className="text-[9px] font-black uppercase text-purple-600 block">Concluídos</span>
          <span className="text-lg font-black text-purple-900 font-mono">{metricas.concluidos}</span>
        </div>
        <div className="bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-2xs">
          <span className="text-[9px] font-black uppercase text-rose-600 block">Passagens UPA</span>
          <span className="text-lg font-black text-rose-900 font-mono">{metricas.upa}</span>
        </div>
        <div className="bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-2xs">
          <span className="text-[9px] font-black uppercase text-emerald-600 block">PSF 1 / PSF 2</span>
          <span className="text-lg font-black text-emerald-900 font-mono">{metricas.psf1 + metricas.psf2}</span>
        </div>
        <div className="bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-2xs">
          <span className="text-[9px] font-black uppercase text-slate-400 block">Espera Média</span>
          <span className="text-xs font-black text-slate-900 font-mono">
            {formatarDuracaoSegundos(metricas.mediaEsperaSeg)}
          </span>
        </div>
        <div className="bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-2xs">
          <span className="text-[9px] font-black uppercase text-slate-400 block">Atend. Médio</span>
          <span className="text-xs font-black text-slate-900 font-mono">
            {formatarDuracaoSegundos(metricas.mediaAtendimentoSeg)}
          </span>
        </div>
        <div className="bg-white p-2.5 rounded-xl border border-slate-200/90 shadow-2xs col-span-2 sm:col-span-1">
          <span className="text-[9px] font-black uppercase text-slate-400 block">Última Passagem</span>
          <span className="text-[11px] font-bold text-slate-800 truncate block">
            {metricas.ultimaPassagem}
          </span>
        </div>
      </div>

      {/* 2. FILTROS E BUSCA */}
      <div className="bg-white rounded-xl p-2.5 border border-slate-200/90 shadow-2xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <div className="relative w-full max-w-xs">
            <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por senha, guichê..."
              value={termoBusca}
              onChange={(e) => setTermoBusca(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-7 pr-2.5 py-1 text-xs font-bold text-slate-900 focus:bg-white focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Filtro Unidade */}
          <select
            value={filtroUnidade}
            onChange={(e) => setFiltroUnidade(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700"
          >
            <option value="TODAS">Todas Unidades</option>
            <option value="upa">UPA</option>
            <option value="psf1">PSF 1</option>
            <option value="psf2">PSF 2</option>
          </select>

          {/* Filtro Status */}
          <select
            value={filtroStatus}
            onChange={(e) => setFiltroStatus(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700"
          >
            <option value="TODOS">Todos Status</option>
            <option value="CONCLUIDO">Concluído</option>
            <option value="EM_ATENDIMENTO">Em Atendimento</option>
            <option value="CHAMANDO">Chamando</option>
            <option value="AGUARDANDO">Aguardando</option>
            <option value="NAO_COMPARECEU">Não Compareceu</option>
            <option value="CANCELADO">Cancelado</option>
          </select>
        </div>
      </div>

      {/* 3. TABELA CRONOLÓGICA DE ATENDIMENTOS */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                <th className="py-2.5 px-3">Data / Hora</th>
                <th className="py-2.5 px-3">Unidade</th>
                <th className="py-2.5 px-3">Senha</th>
                <th className="py-2.5 px-3">Prioridade</th>
                <th className="py-2.5 px-3">Guichê / Operador</th>
                <th className="py-2.5 px-3">Espera</th>
                <th className="py-2.5 px-3">Duração</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {senhasFiltradas.length > 0 ? (
                senhasFiltradas.map((s) => {
                  const d = new Date(s.created_at);
                  const dataFormatada = d.toLocaleDateString('pt-BR');
                  const horaFormatada = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                  const uBadge = getUnidadeBadge(s.unidade_id);
                  const stBadge = getStatusBadge(s.status);

                  return (
                    <tr key={s.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-slate-700">
                        {dataFormatada} <span className="text-slate-400 font-bold">{horaFormatada}</span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] border ${uBadge.bg}`}>
                          {uBadge.label}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-black text-slate-900">
                        {s.numero}
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-slate-700">
                        {s.prioridade_categoria || s.prioridade_tipo}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                        {s.guiche} • {s.atendente_nome || 'Atendente'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">
                        {s.wait_time_first_call_seconds ? formatarDuracaoSegundos(s.wait_time_first_call_seconds) : '—'}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">
                        {s.service_duration_seconds ? formatarDuracaoSegundos(s.service_duration_seconds) : '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${stBadge.bg}`}>
                          {stBadge.label}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSenhaSelecionada(s)}
                          className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold cursor-pointer transition-colors"
                        >
                          Ver Histórico
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-xs text-slate-400 font-semibold">
                    Nenhum atendimento do AutoSenha registrado para este cidadão.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DETALHES DO ATENDIMENTO */}
      {senhaSelecionada && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Detalhes da Passagem</span>
                <h3 className="text-lg font-black text-slate-900 font-mono">
                  Senha {senhaSelecionada.numero} — {senhaSelecionada.unidade_id.toUpperCase()}
                </h3>
              </div>
              <span className={`px-2.5 py-1 rounded-xl text-xs font-black uppercase border ${getStatusBadge(senhaSelecionada.status).bg}`}>
                {getStatusBadge(senhaSelecionada.status).label}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-2xl">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Cidadão</span>
                  <span className="font-bold text-slate-800">{senhaSelecionada.cidadao_nome}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Prioridade</span>
                  <span className="font-bold text-slate-800">{senhaSelecionada.prioridade_categoria || senhaSelecionada.prioridade_tipo}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Local / Guichê</span>
                  <span className="font-bold text-slate-800">{senhaSelecionada.guiche}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Atendente</span>
                  <span className="font-bold text-slate-800">{senhaSelecionada.atendente_nome || 'Recepção'}</span>
                </div>
              </div>

              {/* Linha do tempo das chamadas deste atendimento */}
              <div>
                <span className="text-[11px] font-black uppercase text-slate-500 block mb-2">Cronologia da Passagem</span>
                <div className="space-y-2 border-l-2 border-emerald-500 pl-3 ml-1 text-[11px]">
                  <div>
                    <span className="font-bold text-slate-800">Emissão da Senha:</span>{' '}
                    <span className="font-mono text-slate-600">
                      {new Date(senhaSelecionada.created_at).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  {senhaSelecionada.first_called_at && (
                    <div>
                      <span className="font-bold text-slate-800">Primeira Chamada:</span>{' '}
                      <span className="font-mono text-slate-600">
                        {new Date(senhaSelecionada.first_called_at).toLocaleTimeString('pt-BR')}
                      </span>{' '}
                      (Espera: {formatarDuracaoSegundos(senhaSelecionada.wait_time_first_call_seconds || 0)})
                    </div>
                  )}
                  {senhaSelecionada.call_count > 1 && (
                    <div>
                      <span className="font-bold text-slate-800">Rechamadas:</span>{' '}
                      <span className="font-mono text-slate-600">{senhaSelecionada.call_count} chamadas no total</span>
                    </div>
                  )}
                  {senhaSelecionada.service_started_at && (
                    <div>
                      <span className="font-bold text-slate-800">Início do Atendimento:</span>{' '}
                      <span className="font-mono text-slate-600">
                        {new Date(senhaSelecionada.service_started_at).toLocaleTimeString('pt-BR')}
                      </span>
                    </div>
                  )}
                  {senhaSelecionada.service_finished_at && (
                    <div>
                      <span className="font-bold text-slate-800">Conclusão / Desfecho:</span>{' '}
                      <span className="font-mono text-slate-600">
                        {new Date(senhaSelecionada.service_finished_at).toLocaleTimeString('pt-BR')}
                      </span>{' '}
                      (Duração: {formatarDuracaoSegundos(senhaSelecionada.service_duration_seconds || 0)})
                    </div>
                  )}
                  {senhaSelecionada.motivo_encerramento && (
                    <div className="p-2 rounded-xl bg-rose-50 text-rose-800 border border-rose-200 mt-1">
                      <strong>Motivo do cancelamento / encerramento:</strong> {senhaSelecionada.motivo_encerramento}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-100 mt-4">
              <button
                type="button"
                onClick={() => setSenhaSelecionada(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-black uppercase tracking-wider cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
