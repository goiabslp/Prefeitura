import React, { useState, useEffect, useMemo } from 'react';
import { 
  ArrowLeft, Calendar, Search, RefreshCw, ChevronDown, ChevronUp, ChevronRight,
  FileText, Download, UserCheck, Shield, HelpCircle, Eye, Activity, Clock
} from 'lucide-react';
import { auditLogService, AuditLog } from '../../services/auditLogService';

interface SystemLogsProps {
  onBack: () => void;
}

export const SystemLogs: React.FC<SystemLogsProps> = ({ onBack }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Default to today's date formatted as YYYY-MM-DD in local time
  const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [dateFilter, setDateFilter] = useState<string>(getTodayDateString());
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [selectedUserKey, setSelectedUserKey] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const filters: { date?: string; action_type?: string } = {};
      if (dateFilter) filters.date = dateFilter;
      if (typeFilter !== 'all') filters.action_type = typeFilter;

      const data = await auditLogService.fetchLogs(filters);
      setLogs(data);
    } catch (e) {
      console.error('Failed to load audit logs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [dateFilter, typeFilter]);

  const toggleExpandLog = (id: string) => {
    setExpandedLogId(prev => (prev === id ? null : id));
  };

  // Group logs by user name & email
  const groupedUsers = useMemo(() => {
    const groups: Record<string, {
      user_name: string;
      user_email: string;
      user_id: string | null;
      logs: AuditLog[];
    }> = {};

    logs.forEach(log => {
      const key = `${log.user_name}||${log.user_email || ''}`;
      if (!groups[key]) {
        groups[key] = {
          user_name: log.user_name,
          user_email: log.user_email || '',
          user_id: log.user_id || null,
          logs: []
        };
      }
      groups[key].logs.push(log);
    });

    return Object.values(groups).map(g => {
      const sortedLogs = [...g.logs].sort(
        (a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()
      );
      return {
        ...g,
        lastLog: sortedLogs[0],
        logsCount: g.logs.length
      };
    }).sort((a, b) => b.logsCount - a.logsCount);
  }, [logs]);

  // Find the selected user details if set
  const selectedUser = useMemo(() => {
    if (!selectedUserKey) return null;
    return groupedUsers.find(u => `${u.user_name}||${u.user_email}` === selectedUserKey) || null;
  }, [selectedUserKey, groupedUsers]);

  // Filter users list by search term
  const filteredUsers = useMemo(() => {
    if (selectedUserKey) return [];
    const term = searchTerm.toLowerCase().trim();
    if (!term) return groupedUsers;
    return groupedUsers.filter(u => 
      u.user_name.toLowerCase().includes(term) ||
      u.user_email.toLowerCase().includes(term)
    );
  }, [groupedUsers, searchTerm, selectedUserKey]);

  // Filter selected user's logs by search term
  const filteredLogs = useMemo(() => {
    if (!selectedUser) return [];
    const term = searchTerm.toLowerCase().trim();
    if (!term) return selectedUser.logs;
    return selectedUser.logs.filter(log => 
      log.description.toLowerCase().includes(term) ||
      (log.module && log.module.toLowerCase().includes(term)) ||
      log.action_type.toLowerCase().includes(term)
    );
  }, [selectedUser, searchTerm]);

  const getActionBadge = (type: string) => {
    const baseClass = "inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider border shadow-sm";
    switch (type) {
      case 'login':
        return (
          <span className={`${baseClass} bg-emerald-50 text-emerald-700 border-emerald-100`}>
            <UserCheck className="w-3.5 h-3.5" /> Login
          </span>
        );
      case 'logout':
        return (
          <span className={`${baseClass} bg-rose-50 text-rose-700 border-rose-100`}>
            <UserCheck className="w-3.5 h-3.5" /> Logout
          </span>
        );
      case 'click':
        return (
          <span className={`${baseClass} bg-sky-50 text-sky-700 border-sky-100`}>
            <Eye className="w-3.5 h-3.5" /> Clique
          </span>
        );
      case 'navigation':
        return (
          <span className={`${baseClass} bg-indigo-50 text-indigo-700 border-indigo-100`}>
            <Shield className="w-3.5 h-3.5" /> Navegação
          </span>
        );
      case 'download':
        return (
          <span className={`${baseClass} bg-amber-50 text-amber-700 border-amber-100`}>
            <Download className="w-3.5 h-3.5" /> Download
          </span>
        );
      case 'action':
      case 'modification':
        return (
          <span className={`${baseClass} bg-purple-50 text-purple-700 border-purple-100`}>
            <FileText className="w-3.5 h-3.5" /> Ação
          </span>
        );
      default:
        return (
          <span className={`${baseClass} bg-slate-50 text-slate-700 border-slate-150`}>
            <HelpCircle className="w-3.5 h-3.5" /> Geral
          </span>
        );
    }
  };

  const getModuleBadge = (module: string) => {
    const baseClass = "px-2.5 py-1 text-[9px] font-black rounded-lg uppercase tracking-wider border shadow-sm";
    switch (module.toLowerCase()) {
      case 'compras':
        return <span className={`${baseClass} bg-blue-50 text-blue-700 border-blue-100`}>Compras</span>;
      case 'diarias':
        return <span className={`${baseClass} bg-amber-50 text-amber-700 border-amber-100`}>Diárias</span>;
      case 'oficio':
        return <span className={`${baseClass} bg-violet-50 text-violet-700 border-violet-100`}>Ofícios</span>;
      case 'licitacao':
        return <span className={`${baseClass} bg-orange-50 text-orange-700 border-orange-100`}>Licitação</span>;
      case 'auth':
        return <span className={`${baseClass} bg-emerald-50 text-emerald-700 border-emerald-100`}>Autenticação</span>;
      default:
        return <span className={`${baseClass} bg-slate-100 text-slate-600 border-slate-200`}>{module}</span>;
    }
  };

  const formatLogTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  const formatLogDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] w-full overflow-hidden font-sans">
      {/* Header: Cohesive, Premium Light Mode */}
      <header className="shrink-0 bg-white border-b border-slate-200 px-8 py-5 flex items-center justify-between z-30 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-6">
          <button
            onClick={selectedUserKey ? () => setSelectedUserKey(null) : onBack}
            className="group p-3 rounded-2xl bg-slate-50 text-slate-400 hover:bg-slate-900 hover:text-white transition-all active:scale-95 border border-slate-100 shadow-sm"
            title={selectedUserKey ? "Voltar para Lista de Usuários" : "Voltar ao menu administrativo"}
          >
            <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-0.5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200 flex items-center justify-center">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">
                {selectedUserKey ? "Logs do Usuário" : "Logs de Auditoria"}
              </h1>
              <div className="px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-100 flex items-center gap-1.5 shadow-sm">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Tempo Real</span>
              </div>
            </div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mt-1.5 ml-1">
              {selectedUserKey 
                ? `Visualizando atividade individual de ${selectedUser?.user_name}` 
                : "Monitore e audite cada clique, navegação e ação organizados por usuário."
              }
            </p>
          </div>
        </div>

        <button
          onClick={fetchLogs}
          disabled={loading}
          className="p-3 bg-white hover:bg-indigo-600 active:scale-95 text-slate-500 hover:text-white rounded-2xl transition-all border border-slate-200 hover:border-indigo-600 flex items-center justify-center shadow-sm"
          title="Atualizar Logs"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      {/* Filters Toolbar */}
      <section className="shrink-0 bg-white border-b border-slate-200/80 px-8 py-4 z-20 shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search Input */}
          <div className="relative group">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
              <Search className="w-4 h-4" />
            </span>
            <input
              type="text"
              placeholder={selectedUserKey ? "Filtrar ações deste usuário..." : "Pesquisar usuário por nome ou e-mail..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-slate-50/60 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none rounded-2xl text-xs font-semibold text-slate-700 placeholder-slate-400 transition-all shadow-inner"
            />
          </div>

          {/* Date Filter */}
          <div className="relative group">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
              <Calendar className="w-4 h-4" />
            </span>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full pl-11 pr-16 py-3 bg-slate-50/60 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none rounded-2xl text-xs font-semibold text-slate-700 transition-all shadow-inner"
            />
            {dateFilter && (
              <button
                onClick={() => setDateFilter('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[9px] text-slate-500 hover:text-slate-700 hover:bg-slate-100 font-black uppercase tracking-wider bg-slate-50 border border-slate-200/80 px-2 py-1 rounded-lg transition-all"
              >
                Limpar
              </button>
            )}
          </div>

          {/* Action Type Dropdown */}
          <div className="relative">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50/60 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none rounded-2xl text-xs font-semibold text-slate-700 transition-all shadow-inner cursor-pointer"
            >
              <option value="all">Todas as Ações</option>
              <option value="login">Logins</option>
              <option value="logout">Logouts</option>
              <option value="click">Cliques de Usuários</option>
              <option value="navigation">Navegação de Telas</option>
              <option value="download">Downloads Realizados</option>
              <option value="action">Modificações & Ações do Sistema</option>
            </select>
          </div>
        </div>
      </section>

      {/* Main List Area: Scrollable, light background */}
      <main className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-[#f8fafc]">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-4">
              <div className="relative">
                <div className="w-12 h-12 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin"></div>
                <Activity className="w-5 h-5 text-indigo-600 absolute inset-0 m-auto animate-pulse" />
              </div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Carregando dados...</p>
            </div>
          ) : selectedUserKey ? (
            /* DETAILED USER LOGS VIEW */
            <div className="space-y-4 animate-fade-in">
              {/* Selected User Info Header Card */}
              <div className="bg-white rounded-3xl border border-indigo-100 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm shadow-indigo-100/10">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center font-black text-lg text-white shadow-lg shadow-indigo-200">
                    {selectedUser?.user_name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 leading-tight">{selectedUser?.user_name}</h3>
                    <p className="text-xs text-slate-400 font-semibold mt-1">{selectedUser?.user_email || 'Sem e-mail cadastrado'}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <div className="px-4 py-2 rounded-2xl bg-slate-50 border border-slate-200 text-right">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">Ações Filtradas</span>
                    <span className="text-sm font-extrabold text-slate-700 mt-0.5 block">{filteredLogs.length} de {selectedUser?.logsCount}</span>
                  </div>
                  <button 
                    onClick={() => {
                      setSelectedUserKey(null);
                      setSearchTerm('');
                    }}
                    className="px-6 py-2.5 bg-slate-900 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl hover:bg-indigo-600 active:scale-95 transition-all shadow-md shadow-slate-200"
                  >
                    Ver Outros Usuários
                  </button>
                </div>
              </div>

              {/* User Log List */}
              {filteredLogs.length === 0 ? (
                <div className="py-20 flex flex-col items-center justify-center text-center bg-white rounded-3xl border border-slate-200 shadow-sm">
                  <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mb-4 border border-slate-100">
                    <Search className="w-6 h-6 text-slate-300" />
                  </div>
                  <h4 className="font-extrabold text-sm text-slate-800 uppercase tracking-tight">Nenhum log corresponde aos filtros</h4>
                  <p className="text-xs text-slate-400 mt-1.5 font-medium max-w-xs">Nenhuma ação deste usuário corresponde ao termo de busca ou filtros selecionados.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredLogs.map((log) => {
                    const isExpanded = expandedLogId === log.id;
                    const hasDetails = log.details && Object.keys(log.details).length > 0;

                    return (
                      <div 
                        key={log.id} 
                        onClick={() => hasDetails && toggleExpandLog(log.id!)}
                        className={`group bg-white rounded-2xl border border-slate-200/60 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.01)] hover:shadow-md hover:border-slate-300/80 transition-all duration-300 ${
                          hasDetails ? 'cursor-pointer' : ''
                        }`}
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-slate-700 font-bold leading-relaxed whitespace-pre-wrap break-words">
                              {log.description}
                            </p>
                          </div>

                          <div className="flex items-center justify-between lg:justify-end gap-3.5 shrink-0 border-t border-slate-50 lg:border-t-0 pt-3 lg:pt-0">
                            <div className="flex items-center gap-2">
                              {log.module && getModuleBadge(log.module)}
                              {getActionBadge(log.action_type)}
                            </div>
                            
                            <div className="flex items-center gap-3">
                              <div className="text-right flex flex-row lg:flex-col items-center lg:items-end gap-2 lg:gap-0">
                                <div className="flex items-center gap-1 text-[10px] font-black text-slate-700 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-md lg:bg-transparent lg:border-0 lg:p-0">
                                  <Clock className="w-3 h-3 text-indigo-500 block lg:hidden" />
                                  {formatLogTime(log.created_at)}
                                </div>
                                <div className="text-[9px] font-bold text-slate-400 mt-0.5">{formatLogDate(log.created_at)}</div>
                              </div>

                              {hasDetails && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleExpandLog(log.id!);
                                  }}
                                  className={`p-1.5 rounded-xl border border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all ${
                                    isExpanded ? 'bg-slate-900 border-slate-900 text-white rotate-180 hover:bg-slate-900 hover:text-white' : ''
                                  }`}
                                >
                                  <ChevronDown className="w-4 h-4 transition-transform duration-300" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Expanded details */}
                        {isExpanded && log.details && (
                          <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-200/80 text-[10px] font-mono text-slate-700 overflow-x-auto shadow-inner animate-fade-in whitespace-pre-wrap break-all">
                            <h4 className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-2 border-b border-slate-200 pb-1 font-sans">Metadados e Parâmetros Extra</h4>
                            <pre className="font-mono text-slate-600">{JSON.stringify(log.details, null, 2)}</pre>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* GROUPED USERS LIST VIEW */
            <div className="space-y-4 animate-fade-in">
              {filteredUsers.length === 0 ? (
                <div className="py-24 flex flex-col items-center justify-center text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-200 shadow-sm">
                  <div className="w-20 h-20 bg-slate-50 rounded-[2.5rem] flex items-center justify-center mb-6 border border-slate-100">
                    <Search className="w-8 h-8 text-slate-300" />
                  </div>
                  <h3 className="font-black text-lg text-slate-800 uppercase tracking-tight">Nenhum usuário corresponde aos filtros</h3>
                  <p className="text-xs text-slate-400 font-medium max-w-sm mt-2">Não foram encontrados usuários com logs registrados correspondentes à pesquisa e filtros aplicados.</p>
                  {(searchTerm || dateFilter || typeFilter !== 'all') && (
                    <button 
                      onClick={() => {
                        setSearchTerm('');
                        setDateFilter(getTodayDateString());
                        setTypeFilter('all');
                      }}
                      className="mt-6 px-6 py-2.5 bg-indigo-600 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-slate-900 transition-all active:scale-95 shadow-md shadow-indigo-100"
                    >
                      Limpar Filtros
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {filteredUsers.map((u) => (
                    <div 
                      key={`${u.user_name}||${u.user_email}`} 
                      onClick={() => {
                        setSelectedUserKey(`${u.user_name}||${u.user_email}`);
                        setSearchTerm(''); // Clear filter when entering user detail
                      }}
                      className="group bg-white rounded-2xl border border-slate-200/60 p-5 shadow-[0_1px_3px_rgba(0,0,0,0.01)] hover:shadow-md hover:border-slate-300/80 hover:-translate-y-0.5 transition-all duration-300 cursor-pointer flex items-center justify-between gap-6 animate-fade-in"
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        {/* Avatar */}
                        <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center font-black text-sm text-indigo-600 shadow-inner group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 shrink-0">
                          {u.user_name.substring(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-extrabold text-sm text-slate-850 group-hover:text-indigo-600 transition-colors leading-tight">{u.user_name}</h3>
                          <p className="text-xs text-slate-400 font-semibold mt-1.5">{u.user_email || 'Sem e-mail cadastrado'}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="text-right hidden sm:block">
                          <span className="text-[8px] font-black text-slate-450 uppercase tracking-widest block">Última atividade</span>
                          <span className="text-[11px] font-bold text-slate-600 mt-1 block">
                            {u.lastLog ? `${formatLogTime(u.lastLog.created_at)} (${formatLogDate(u.lastLog.created_at)})` : 'N/A'}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <span className="px-3.5 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] font-black uppercase tracking-wider shadow-sm">
                            {u.logsCount} {u.logsCount === 1 ? 'ação' : 'ações'}
                          </span>
                          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform duration-300" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <style dangerouslySetInnerHTML={{
        __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
          height: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 9999px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}} />
    </div>
  );
};
