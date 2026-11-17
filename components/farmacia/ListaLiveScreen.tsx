import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ArrowLeft, Search, X, Radio, AlertCircle, RefreshCw, PackageCheck } from 'lucide-react';
import { FarmaciaMedicamento, User } from '../../types';
import * as db from '../../services/farmaciaService';
import { supabase } from '../../services/supabaseClient';
import {
  consolidarMedicamentosListaLive,
  filtrarListaLive,
  getHojeBrasilFarmaciaISO
} from '../../utils/farmaciaListaLiveUtils';

interface ListaLiveScreenProps {
  currentUser?: User | null;
  onBack: () => void;
}

export const ListaLiveScreen: React.FC<ListaLiveScreenProps> = ({ onBack }) => {
  const [medicamentos, setMedicamentos] = useState<FarmaciaMedicamento[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [hojeBrasilISO, setHojeBrasilISO] = useState<string>(() => getHojeBrasilFarmaciaISO());
  const [isRealtimeConnected, setIsRealtimeConnected] = useState<boolean>(false);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef<boolean>(true);

  // Carrega os registros reais do estoque diretamente do Supabase (sempre ignorando cache vencido quando force=true)
  const carregarEstoqueReal = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    setLoadError(null);
    try {
      db.invalidateMedicamentosCache();
      const dadosReais = await db.getMedicamentos(true);
      if (!isMountedRef.current) return;
      setMedicamentos(Array.isArray(dadosReais) ? dadosReais : []);
      setHojeBrasilISO(getHojeBrasilFarmaciaISO());
    } catch (err: any) {
      console.error('[ListaLiveScreen] Erro ao carregar estoque real da Farmácia Popular:', err);
      if (!isMountedRef.current) return;
      if (!silent) {
        setMedicamentos([]);
      }
      setLoadError(err?.message || 'Não foi possível consultar o estoque real no momento.');
    } finally {
      if (isMountedRef.current && !silent) {
        setLoading(false);
      }
    }
  }, []);

  // Atualização silenciosa com pequeno debounce para absorver movimentações em lote sem piscar a tela
  const agendarAtualizacaoTempoReal = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      carregarEstoqueReal(true);
    }, 150);
  }, [carregarEstoqueReal]);

  // Carga inicial, assinatura Supabase Realtime e listeners de eventos locais
  useEffect(() => {
    isMountedRef.current = true;
    carregarEstoqueReal(false);

    const handleLocalEvent = () => agendarAtualizacaoTempoReal();
    window.addEventListener('farmacia-medicamentos-changed', handleLocalEvent);
    window.addEventListener('farmacia-movimentacoes-changed', handleLocalEvent);

    // Canal dedicado do Supabase Realtime para refletir entradas, retiradas e reposições instantaneamente
    const realtimeChannel = supabase
      .channel('farmacia_lista_live_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'farmacia_medicamentos' },
        () => {
          agendarAtualizacaoTempoReal();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'farmacia_movimentacoes' },
        () => {
          agendarAtualizacaoTempoReal();
        }
      )
      .subscribe((status) => {
        if (isMountedRef.current) {
          setIsRealtimeConnected(status === 'SUBSCRIBED');
        }
      });

    // Atualiza referência de data de Brasília a cada 60s para ocultar lotes que vencerem na virada do dia
    const dateInterval = setInterval(() => {
      const novaData = getHojeBrasilFarmaciaISO();
      setHojeBrasilISO((prev) => (prev !== novaData ? novaData : prev));
    }, 60000);

    return () => {
      isMountedRef.current = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      clearInterval(dateInterval);
      window.removeEventListener('farmacia-medicamentos-changed', handleLocalEvent);
      window.removeEventListener('farmacia-movimentacoes-changed', handleLocalEvent);
      supabase.removeChannel(realtimeChannel);
    };
  }, [carregarEstoqueReal, agendarAtualizacaoTempoReal]);

  // Consolidação real dos medicamentos disponíveis (> 0, não vencidos, sem duplicar lotes, ordem A-Z)
  const medicamentosDisponiveis = useMemo(() => {
    return consolidarMedicamentosListaLive(medicamentos, hojeBrasilISO);
  }, [medicamentos, hojeBrasilISO]);

  // Filtragem dinâmica em tempo real por nome ou apresentação (mantendo ordem alfabética A-Z)
  const itensExibidos = useMemo(() => {
    return filtrarListaLive(medicamentosDisponiveis, searchTerm);
  }, [medicamentosDisponiveis, searchTerm]);

  const totalExibido = itensExibidos.length;

  const handleClearSearch = () => {
    setSearchTerm('');
    searchInputRef.current?.focus();
  };

  return (
    <div className="flex-1 w-full h-full flex flex-col min-h-0 bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden animate-in fade-in duration-200">
      {/* ===================================================================== */}
      {/* CABEÇALHO COMPACTO + CONTADOR + PESQUISA DINÂMICA                     */}
      {/* ===================================================================== */}
      <header className="shrink-0 bg-white border-b border-slate-200/80 px-3 sm:px-5 py-2.5 sm:py-3 space-y-2.5">
        {/* Linha 1: Voltar + Título/Subtítulo + Contador + Status Ao Vivo */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-pink-50 border border-slate-200/80 hover:border-pink-200 text-slate-500 hover:text-pink-600 flex items-center justify-center transition-all active:scale-95 shrink-0 cursor-pointer"
              title="Voltar ao Menu da Farmácia Popular"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xs sm:text-sm md:text-base font-black text-slate-900 tracking-tight uppercase leading-tight truncate">
                  LISTA LIVE — MEDICAMENTOS DISPONÍVEIS
                </h1>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border shrink-0 ${
                    isRealtimeConnected
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}
                  title={isRealtimeConnected ? 'Conectado em tempo real ao Supabase' : 'Sincronização automática ativa'}
                >
                  <span className="relative flex h-1.5 w-1.5">
                    {isRealtimeConnected && (
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    )}
                    <span
                      className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                        isRealtimeConnected ? 'bg-emerald-500' : 'bg-slate-400'
                      }`}
                    />
                  </span>
                  <Radio className="w-2.5 h-2.5" />
                  <span>LIVE</span>
                </span>
              </div>
              <p className="text-[10.5px] sm:text-xs text-slate-500 font-medium leading-tight mt-0.5 truncate">
                Consulta em tempo real dos medicamentos disponíveis na Farmácia Popular.
              </p>
            </div>
          </div>

          {/* Contador oficial: quantidade de medicamentos/apresentações disponíveis na listagem */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50/90 border border-emerald-200/80 text-emerald-800 shadow-2xs">
              <PackageCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="text-[11px] sm:text-xs font-extrabold tabular-nums">
                {totalExibido} {totalExibido === 1 ? 'medicamento disponível' : 'medicamentos disponíveis'}
              </span>
            </div>
          </div>
        </div>

        {/* Linha 2: Campo único de pesquisa dinâmica */}
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pesquisar medicamento ou apresentação..."
            aria-label="Pesquisar medicamento ou apresentação"
            className="w-full pl-9 pr-9 py-2 bg-slate-50/90 hover:bg-slate-50 focus:bg-white border border-slate-200/90 focus:border-pink-400 focus:ring-2 focus:ring-pink-500/15 rounded-xl text-xs sm:text-sm font-medium text-slate-800 placeholder:text-slate-400 outline-none transition-all"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={handleClearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
              title="Limpar pesquisa"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </header>

      {/* ===================================================================== */}
      {/* TABELA FULL-WIDTH / FULL-VIEWPORT COM CABEÇALHO FIXO                  */}
      {/* ===================================================================== */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar bg-white">
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center py-16 px-4 text-center space-y-2.5">
            <RefreshCw className="w-6 h-6 text-pink-500 animate-spin" />
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Consultando estoque disponível em tempo real...
            </p>
          </div>
        ) : loadError ? (
          <div className="h-full flex flex-col items-center justify-center py-16 px-4 text-center space-y-3">
            <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="space-y-1 max-w-md">
              <h2 className="text-xs sm:text-sm font-black text-rose-800 uppercase">
                Falha ao carregar o estoque disponível
              </h2>
              <p className="text-xs text-slate-500 font-medium">{loadError}</p>
            </div>
            <button
              type="button"
              onClick={() => carregarEstoqueReal(false)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold uppercase tracking-wider shadow-xs transition-all active:scale-95 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Tentar novamente</span>
            </button>
          </div>
        ) : itensExibidos.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center py-16 px-4 text-center space-y-2">
            <div className="w-11 h-11 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center">
              <Search className="w-5 h-5" />
            </div>
            <h2 className="text-xs sm:text-sm font-black text-slate-700 uppercase">
              {searchTerm.trim()
                ? 'Nenhum medicamento disponível encontrado para a pesquisa'
                : 'Nenhum medicamento disponível em estoque no momento'}
            </h2>
            <p className="text-xs text-slate-400 max-w-sm">
              {searchTerm.trim()
                ? 'Verifique o termo digitado ou limpe o campo de pesquisa para visualizar todos os itens disponíveis.'
                : 'Assim que houver entrada ou reposição no estoque da Farmácia Popular, os itens aparecerão automaticamente aqui.'}
            </p>
            {searchTerm.trim() && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="mt-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
              >
                Limpar pesquisa
              </button>
            )}
          </div>
        ) : (
          <table className="w-full table-fixed border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-xs border-b border-slate-200 shadow-2xs">
              <tr>
                <th
                  scope="col"
                  className="w-[46%] sm:w-[48%] py-2 px-2.5 sm:px-5 text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-600"
                >
                  Medicamento
                </th>
                <th
                  scope="col"
                  className="w-[36%] sm:w-[37%] py-2 px-2 sm:px-4 text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-600"
                >
                  Apresentação
                </th>
                <th
                  scope="col"
                  className="w-[18%] sm:w-[15%] py-2 px-2.5 sm:px-5 text-right text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-600"
                >
                  Estoque
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {itensExibidos.map((item) => (
                <tr
                  key={item.key}
                  className="even:bg-slate-50/40 hover:bg-emerald-50/45 transition-colors"
                >
                  <td className="py-1.5 sm:py-2 px-2.5 sm:px-5 align-middle text-[11.5px] sm:text-[13px] font-bold text-slate-900 break-words leading-snug">
                    {item.nome}
                  </td>
                  <td className="py-1.5 sm:py-2 px-2 sm:px-4 align-middle text-[11px] sm:text-xs font-medium text-slate-600 break-words leading-snug">
                    {item.apresentacao}
                  </td>
                  <td className="py-1.5 sm:py-2 px-2.5 sm:px-5 align-middle text-right text-[12px] sm:text-[13px] font-extrabold text-emerald-700 tabular-nums whitespace-nowrap">
                    {item.estoque.toLocaleString('pt-BR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
