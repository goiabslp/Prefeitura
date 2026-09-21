import React, { useState, useEffect } from 'react';
import { RhHorasExtras } from '../../types';
import { getRhHorasExtrasHistory, deleteRhHorasExtras } from '../../services/rhService';
import { 
  FileDown, 
  Calendar, 
  Users, 
  Signature, 
  Search, 
  Trash2, 
  Edit2, 
  ArrowLeft, 
  History, 
  RefreshCcw, 
  User, 
  FileText, 
  X, 
  CheckCircle2, 
  Clock 
} from 'lucide-react';
import { ModernMonthPicker } from '../common/ModernMonthPicker';

interface HorasExtrasHistoryProps {
  onDownloadPdf: (record: RhHorasExtras) => void;
  onEdit: (record: RhHorasExtras) => void;
  onView?: (record: RhHorasExtras) => void;
  highlightId?: string | null;
  userRole: string;
  currentUserSector: string;
  lastRefresh?: number;
  onBack?: () => void;
}

export const HorasExtrasHistory: React.FC<HorasExtrasHistoryProps> = ({
  onDownloadPdf,
  onEdit,
  onView,
  highlightId,
  userRole,
  currentUserSector,
  lastRefresh,
  onBack
}) => {
  const [history, setHistory] = useState<RhHorasExtras[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadHistory();
  }, [lastRefresh]);

  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const { data } = await getRhHorasExtrasHistory(1, 100);
      setHistory(data);
    } catch (error) {
      console.error('Error loading Horas Extras history:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadHistory();
  };

  const handleDelete = async (id: string, month: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir o relatório de "${month}"? Esta ação não pode ser desfeita.`)) {
      return;
    }

    setIsDeleting(id);
    try {
      await deleteRhHorasExtras(id);
      await loadHistory();
    } catch (error) {
      console.error('Falha ao excluir o registro:', error);
      alert('Não foi possível excluir o registro. Tente novamente mais tarde.');
    } finally {
      setIsDeleting(null);
    }
  };

  const filteredHistory = history.filter(item => {
    // 1. Filtrar por setor caso o usuário não seja administrador
    if (userRole !== 'admin' && item.sector !== currentUserSector) {
      return false;
    }

    // 2. Filtrar pelo mês selecionado
    if (selectedMonth) {
      const [selYear, selMonth] = selectedMonth.split('-');
      const monthsMap: Record<string, string> = {
        '01': 'Janeiro', '02': 'Fevereiro', '03': 'Março', '04': 'Abril',
        '05': 'Maio', '06': 'Junho', '07': 'Julho', '08': 'Agosto',
        '09': 'Setembro', '10': 'Outubro', '11': 'Novembro', '12': 'Dezembro'
      };
      const selMonthName = monthsMap[selMonth];
      const selFormatted = `${selMonth}/${selYear}`;

      let itemYear = item.created_at ? new Date(item.created_at).getFullYear().toString() : new Date().getFullYear().toString();
      let itemMonth = item.month;

      if (item.month && item.month.includes('/')) {
        const parts = item.month.split('/');
        itemMonth = parts[0];
        itemYear = parts[1];
      }

      const matchNameAndYear = itemMonth.toLowerCase() === selMonthName?.toLowerCase() && itemYear === selYear;
      const matchFormatted = item.month === selFormatted;

      if (!matchNameAndYear && !matchFormatted) {
        return false;
      }
    }

    // 3. Filtrar pelo termo de busca
    if (!searchTerm.trim()) return true;
    const searchPrefix = searchTerm.toLowerCase();
    return (
      (item.month && item.month.toLowerCase().includes(searchPrefix)) ||
      (item.sector && item.sector.toLowerCase().includes(searchPrefix)) ||
      (item.user_name && item.user_name.toLowerCase().includes(searchPrefix)) ||
      (item.id && item.id.toLowerCase().includes(searchPrefix))
    );
  });

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Data não disponível';
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(dateString));
  };

  return (
    <div className="w-full h-full flex-1 flex flex-col min-h-0 bg-white rounded-2xl md:rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden font-sans">
      
      {/* ========================================================================= */}
      {/* 1. TOP HEADER DA TABELA / LISTA (100% LARGURA) */}
      {/* ========================================================================= */}
      <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200/80 bg-white shrink-0">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
          
          {/* Lado Esquerdo: Voltar + Título + Badges */}
          <div className="flex items-center gap-3 min-w-0">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 rounded-xl bg-slate-100 hover:bg-indigo-50 border border-slate-200 text-slate-600 hover:text-indigo-600 transition-all active:scale-95 cursor-pointer shrink-0"
                title="Voltar ao Painel do RH"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
                <History className="w-4.5 h-4.5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight leading-none uppercase truncate">
                    Histórico de Lançamentos
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-black border border-indigo-200/60 uppercase shrink-0">
                    {filteredHistory.length} {filteredHistory.length === 1 ? 'Folha' : 'Folhas'}
                  </span>
                </div>
                <p className="text-[11px] font-bold text-slate-400 mt-0.5 truncate">
                  Acompanhamento de horas extras e planilhas fechadas por departamento
                </p>
              </div>
            </div>
          </div>

          {/* Lado Direito: Filtros (Mês, Busca, Atualizar) */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-2.5 w-full lg:w-auto shrink-0">
            {/* Seletor Moderno de Mês */}
            <div className="w-full sm:w-44 shrink-0">
              <ModernMonthPicker
                value={selectedMonth}
                onChange={setSelectedMonth}
                className="w-full"
              />
            </div>

            {/* Campo de Busca Compacto */}
            <div className="relative flex-1 sm:w-60 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por setor, responsável..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-50/80 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  title="Limpar busca"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Botão de Atualização em Tempo Real */}
            <button
              onClick={handleRefresh}
              disabled={isLoading || isRefreshing}
              className="p-2 sm:px-3 sm:py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 hover:text-indigo-600 rounded-xl transition-all font-bold text-xs flex items-center gap-1.5 active:scale-95 cursor-pointer shrink-0 disabled:opacity-50"
              title="Atualizar lançamentos"
            >
              <RefreshCcw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-600' : ''}`} />
              <span className="hidden sm:inline text-[11px] uppercase tracking-wider font-extrabold">Atualizar</span>
            </button>
          </div>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. CABEÇALHO DAS COLUNAS (MODO LISTA COMPACTO - DESKTOP) */}
      {/* ========================================================================= */}
      <div className="hidden lg:grid grid-cols-12 gap-3 px-4 sm:px-6 py-2.5 bg-slate-50 border-b border-slate-200/80 shrink-0 text-[10px] font-black uppercase text-slate-500 tracking-wider items-center select-none">
        <div className="col-span-2 flex items-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>Mês / Ano</span>
        </div>
        <div className="col-span-2 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span>Data Emissão</span>
        </div>
        <div className="col-span-3">Setor Solicitante</div>
        <div className="col-span-2">Responsável / Emissor</div>
        <div className="col-span-1 text-center">Equipe</div>
        <div className="col-span-2 text-right pr-2">Ações</div>
      </div>

      {/* ========================================================================= */}
      {/* 3. CORPO DA LISTA DE LANÇAMENTOS (100% LARGURA & SCROLL SUAVE) */}
      {/* ========================================================================= */}
      <div className="flex-1 overflow-y-auto custom-scrollbar min-h-0 divide-y divide-slate-100 bg-white">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
            <div className="w-12 h-12 border-3 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-3"></div>
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wide">Carregando histórico de horas extras...</h3>
            <p className="text-slate-400 text-xs mt-1">Buscando planilhas cadastradas no banco de dados.</p>
          </div>
        ) : filteredHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mb-3 text-slate-400">
              <FileText className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Nenhum lançamento encontrado</h3>
            <p className="text-slate-500 text-xs mt-1 max-w-sm">
              {searchTerm 
                ? `Nenhuma planilha encontrada para "${searchTerm}". Tente outros termos.` 
                : "Não há registros de horas extras fechados para o período selecionado."}
            </p>
          </div>
        ) : (
          filteredHistory.map((record) => {
            const isHighlighted = record.id === highlightId;
            const isRecordDeleting = isDeleting === record.id;
            
            // Tratamento visual de Mês / Ano
            let mesStr = record.month;
            let anoStr = record.created_at ? new Date(record.created_at).getFullYear().toString() : new Date().getFullYear().toString();

            if (record.month && record.month.includes('/')) {
              const parts = record.month.split('/');
              mesStr = parts[0];
              anoStr = parts[1];
            }

            const displayAno = anoStr?.length === 4 ? anoStr.substring(2) : anoStr;
            const displayMesFormatado = mesStr ? (mesStr.length > 3 ? mesStr.substring(0, 3).toUpperCase() : mesStr.toUpperCase()) : 'MÊS';

            return (
              <div
                key={record.id}
                className={`group px-4 sm:px-6 py-2.5 sm:py-3 transition-colors hover:bg-slate-50/90 flex flex-col lg:grid lg:grid-cols-12 gap-2.5 lg:gap-3 items-start lg:items-center text-xs font-semibold ${
                  isHighlighted ? 'bg-indigo-50/70 border-l-4 border-indigo-600' : ''
                } ${isRecordDeleting ? 'opacity-50 pointer-events-none' : ''}`}
              >
                {/* 1. MÊS / ANO (Chip Compacto) */}
                <div className="col-span-2 flex items-center gap-2 w-full lg:w-auto">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50/80 border border-indigo-100 text-indigo-900 font-black text-[11px] tracking-tight shrink-0 shadow-2xs">
                    <span className="text-indigo-600 uppercase">{displayMesFormatado}</span>
                    <span className="text-slate-400">/</span>
                    <span className="text-indigo-950 font-bold">{anoStr || displayAno}</span>
                  </div>
                  
                  {/* Badge de Protocolo no Mobile */}
                  <div className="lg:hidden flex items-center gap-1.5 ml-auto">
                    <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-mono font-bold">
                      #{record.id?.substring(0, 6)}
                    </span>
                  </div>
                </div>

                {/* 2. DATA DE EMISSÃO & PROTOCOLO */}
                <div className="col-span-2 flex flex-col min-w-0">
                  <div className="hidden lg:flex items-center gap-1 text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50/60 px-1.5 py-0.5 rounded w-fit">
                    #{record.id?.substring(0, 6)}
                  </div>
                  <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap mt-0.5">
                    {formatDate(record.created_at)}
                  </span>
                </div>

                {/* 3. SETOR SOLICITANTE */}
                <div className="col-span-3 flex flex-col min-w-0 w-full">
                  <span className="text-xs sm:text-[13px] font-bold text-slate-900 group-hover:text-indigo-700 transition-colors truncate" title={record.sector}>
                    {record.sector || 'Departamento Geral'}
                  </span>
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    Setor Solicitante
                  </span>
                </div>

                {/* 4. RESPONSÁVEL / EMISSOR */}
                <div className="col-span-2 flex items-center gap-2 min-w-0 w-full">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-100 to-indigo-200 border border-indigo-300/60 text-indigo-800 flex items-center justify-center font-black text-[10px] uppercase shrink-0 shadow-2xs">
                    {record.user_name ? record.user_name.substring(0, 2).toUpperCase() : <User className="w-3.5 h-3.5 text-indigo-600" />}
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-slate-800 truncate" title={record.user_name}>
                      {record.user_name || 'Servidor Municipal'}
                    </span>
                    <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1 whitespace-nowrap">
                      <Signature className="w-2.5 h-2.5 shrink-0" /> Assinado Elet.
                    </span>
                  </div>
                </div>

                {/* 5. EQUIPE (COLABORADORES) */}
                <div className="col-span-1 flex items-center justify-start lg:justify-center w-full lg:w-auto shrink-0">
                  <div 
                    className="flex items-center gap-1 bg-blue-50/80 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200/60 text-xs font-black shadow-2xs" 
                    title={`${record.entries?.length || 0} colaboradores listados nesta planilha`}
                  >
                    <Users className="w-3 h-3 text-blue-600" />
                    <span>{record.entries?.length || 0}</span>
                  </div>
                </div>

                {/* 6. AÇÕES */}
                <div className="col-span-2 flex items-center justify-end gap-1.5 w-full lg:w-auto pt-2 lg:pt-0 border-t border-slate-100 lg:border-t-0 shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); onDownloadPdf(record); }}
                    className="p-1.5 sm:p-2 bg-white border border-slate-200 hover:border-indigo-300 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all shadow-2xs active:scale-95 cursor-pointer"
                    title="Baixar Relatório PDF Oficial"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={(e) => { e.stopPropagation(); onEdit(record); }}
                    className="p-1.5 sm:p-2 bg-white border border-slate-200 hover:border-amber-300 text-slate-600 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all shadow-2xs active:scale-95 cursor-pointer"
                    title="Editar Registro"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  {userRole === 'admin' && onView && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onView(record); }}
                      className="p-1.5 sm:p-2 bg-white border border-slate-200 hover:border-emerald-300 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all shadow-2xs active:scale-95 cursor-pointer"
                      title="Visualizar Detalhes"
                    >
                      <Search className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(record.id!, record.month); }}
                    disabled={isRecordDeleting}
                    className="p-1.5 sm:p-2 bg-white border border-slate-200 hover:border-rose-300 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all shadow-2xs active:scale-95 cursor-pointer disabled:opacity-50"
                    title="Excluir Folha"
                  >
                    {isRecordDeleting ? (
                      <div className="w-3.5 h-3.5 border-2 border-rose-600 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <Trash2 className="w-3.5 h-3.5 text-rose-500 hover:text-rose-700" />
                    )}
                  </button>
                </div>

              </div>
            );
          })
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4. FOOTER / BARRA DE RESUMO COMPACTA */}
      {/* ========================================================================= */}
      <div className="px-4 sm:px-6 py-2.5 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-[11px] font-bold text-slate-500 shrink-0">
        <div className="flex items-center gap-2">
          <span>Exibindo <strong>{filteredHistory.length}</strong> de <strong>{history.length}</strong> lançamentos</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-400">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          <span>Sincronizado com o banco de dados</span>
        </div>
      </div>

    </div>
  );
};


