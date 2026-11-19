import React, { useState, useEffect } from 'react';
import { User, ConsultaPaciente } from '../../../types';
import * as db from '../../../services/consultasService';
import { supabase } from '../../../services/supabaseClient';
import { formatCpf, formatBirthDateBr } from '../../../utils/cpfUtils';
import { 
  ShieldAlert, 
  ArrowLeft, 
  Users, 
  Calendar, 
  CreditCard, 
  AlertTriangle, 
  CheckCircle2, 
  Loader2, 
  Search,
  ExternalLink,
  FileText,
  Clock,
  Sparkles,
  Info
} from 'lucide-react';

interface PacientesDuplicidadesScreenProps {
  onBack: () => void;
  currentUser?: User | null;
  baseRoute?: string;
}

interface ItemAuditoriaDuplicado {
  id: string;
  name: string;
  nickname?: string | null;
  cpf: string;
  birth_date: string;
  phone?: string | null;
  neighborhood?: string | null;
  street?: string | null;
  city?: string | null;
  sus_number?: string | null;
  agente_saude?: string | null;
  created_at: string;
  nome_norm: string;
  total_duplicados: number;
  total_agendamentos: number;
}

export const PacientesDuplicidadesScreen: React.FC<PacientesDuplicidadesScreenProps> = ({
  onBack,
  currentUser,
  baseRoute = '/Regulacao/Pacientes'
}) => {
  const [duplicados, setDuplicados] = useState<ItemAuditoriaDuplicado[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSearch, setFilterSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'historicos' | 'conferencias'>('historicos');
  const [conferencias, setConferencias] = useState<any[]>([]);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const data = await db.getPacientesDuplicadosAuditoria();
      setDuplicados(data as ItemAuditoriaDuplicado[]);

      // Carrega pendências de conferência administrativa
      const { data: confData } = await supabase
        .from('pacientes_conferencia_administrativa')
        .select('*')
        .order('created_at', { ascending: false });
      setConferencias(confData || []);
    } catch (err) {
      console.error('Erro ao carregar auditoria de duplicidades:', err);
    } finally {
      setLoading(false);
    }
  };

  // Agrupa os pacientes duplicados por nome_norm e birth_date
  const gruposDuplicados = React.useMemo(() => {
    const map = new Map<string, ItemAuditoriaDuplicado[]>();
    for (const item of duplicados) {
      const key = `${item.nome_norm}__${item.birth_date}`;
      const list = map.get(key) || [];
      list.push(item);
      map.set(key, list);
    }
    return Array.from(map.entries()).map(([key, items]) => ({
      key,
      nomeNorm: items[0].nome_norm,
      birthDate: items[0].birth_date,
      items
    }));
  }, [duplicados]);

  const gruposFiltrados = React.useMemo(() => {
    if (!filterSearch.trim()) return gruposDuplicados;
    const term = filterSearch.toLowerCase().trim();
    return gruposDuplicados.filter(g => 
      g.nomeNorm.includes(term) || 
      g.items.some(p => p.cpf.includes(term) || (p.name || '').toLowerCase().includes(term))
    );
  }, [gruposDuplicados, filterSearch]);

  return (
    <div className="w-full h-full flex flex-col bg-slate-50 min-h-0 overflow-hidden">
      
      {/* Barra Superior */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 shadow-2xs">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Voltar para Gestão de Pacientes"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/80">
                Auditoria de Integridade
              </span>
              <span className="text-xs font-mono font-bold text-slate-400">
                /Regulacao/Pacientes/Duplicidades
              </span>
            </div>
            <h1 className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2 mt-0.5">
              <ShieldAlert className="w-5 h-5 text-amber-600" />
              Relatório de Duplicidades e Conferência Administrativa
            </h1>
          </div>
        </div>

        {/* Abas Superiores */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={() => setActiveTab('historicos')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'historicos'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Casos Históricos ({gruposDuplicados.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('conferencias')}
            className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'conferencias'
                ? 'bg-purple-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Conferências Solicitadas ({conferencias.length})</span>
          </button>
        </div>
      </div>

      {/* Conteúdo Principal com Rolagem */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
        
        {/* Banner Informativo */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 text-amber-950 flex items-start gap-3 shadow-2xs">
          <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <p className="font-black uppercase tracking-wide text-amber-900">
              Diretriz Municipal de Segurança e Prevenção de Perda de Dados
            </p>
            <p className="text-amber-800 leading-relaxed font-medium">
              Conforme as regras do sistema, pacientes duplicados cadastrados anteriormente não foram excluídos automaticamente para proteger históricos clínicos e agendamentos existentes. O banco de dados agora bloqueia 100% de novas duplicidades (por CPF ou Nome + Data de Nascimento). Utilize este relatório para analisar divergências de digitação e consolidar os registros com segurança.
            </p>
          </div>
        </div>

        {/* Barra de Pesquisa */}
        <div className="flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={filterSearch}
              onChange={e => setFilterSearch(e.target.value)}
              placeholder="Pesquisar por nome ou CPF..."
              className="w-full pl-10 pr-3.5 py-2 bg-white border border-slate-200 focus:border-amber-600 rounded-xl text-xs font-bold text-slate-800 outline-none transition-all shadow-2xs placeholder:text-slate-400"
            />
          </div>
          <span className="text-xs font-bold text-slate-500">
            {activeTab === 'historicos' ? `${gruposFiltrados.length} grupos encontrados` : `${conferencias.length} solicitações`}
          </span>
        </div>

        {loading ? (
          <div className="py-20 text-center space-y-3">
            <Loader2 className="w-8 h-8 text-amber-600 animate-spin mx-auto" />
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Carregando auditoria de duplicidades...
            </p>
          </div>
        ) : activeTab === 'historicos' ? (
          /* Lista de Casos Históricos de Duplicidade */
          <div className="space-y-4">
            {gruposFiltrados.length === 0 ? (
              <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 p-6 space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
                <p className="text-sm font-black text-slate-800 uppercase">
                  Nenhuma duplicidade pendente encontrada
                </p>
                <p className="text-xs text-slate-400">
                  A base de pacientes está em total conformidade com as regras de unicidade.
                </p>
              </div>
            ) : (
              gruposFiltrados.map((grupo, idx) => (
                <div 
                  key={grupo.key} 
                  className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs hover:shadow-xs transition-shadow"
                >
                  {/* Cabeçalho do Grupo */}
                  <div className="p-3.5 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 text-xs font-black font-mono flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div>
                        <span className="text-xs sm:text-sm font-black text-slate-900 uppercase">
                          {grupo.items[0].name}
                        </span>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-semibold mt-0.5">
                          <span>Nascimento: <strong>{formatBirthDateBr(grupo.birthDate)}</strong></span>
                          <span>•</span>
                          <span>{grupo.items.length} cadastros coincidentes</span>
                        </div>
                      </div>
                    </div>

                    <span className="px-2.5 py-1 bg-amber-100 text-amber-900 text-[10px] font-black uppercase rounded-lg border border-amber-200">
                      Coincidência: Nome + Data de Nascimento
                    </span>
                  </div>

                  {/* Comparativo Lado a Lado dos Registros */}
                  <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {grupo.items.map((item, itemIdx) => {
                      const isMaisAntigo = itemIdx === 0;
                      return (
                        <div 
                          key={item.id} 
                          className={`p-3.5 rounded-xl border text-xs space-y-2.5 ${
                            item.total_agendamentos > 0 
                              ? 'bg-indigo-50/40 border-indigo-200' 
                              : 'bg-white border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                              Registro #{itemIdx + 1} • {isMaisAntigo ? 'Criado Primeiro' : 'Cadastrado Posteriormente'}
                            </span>
                            <span className="text-[9px] font-mono text-slate-400">
                              {item.id.slice(0, 8)}...
                            </span>
                          </div>

                          <div className="space-y-1">
                            <p className="font-black text-slate-900 uppercase text-xs">
                              {item.name}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 text-[11px]">
                              <span className="font-mono font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                                CPF: {formatCpf(item.cpf)}
                              </span>
                              {item.phone && (
                                <span className="text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                                  Tel: {item.phone}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                            <span className="text-slate-500 font-medium">
                              Agendamentos vinculados: <strong className={item.total_agendamentos > 0 ? 'text-indigo-700 font-black' : 'text-slate-700'}>{item.total_agendamentos}</strong>
                            </span>
                            <span className="text-[10px] text-slate-400">
                              Criado em: {new Date(item.created_at).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          /* Lista de Conferências Administrativas Solicitadas */
          <div className="space-y-3">
            {conferencias.length === 0 ? (
              <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 p-6 space-y-2">
                <FileText className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-black text-slate-700 uppercase">
                  Nenhuma conferência administrativa pendente
                </p>
                <p className="text-xs text-slate-400">
                  As solicitações enviadas ao detectar divergências ou homônimos aparecerão aqui.
                </p>
              </div>
            ) : (
              conferencias.map((conf, cIdx) => (
                <div 
                  key={conf.id} 
                  className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-purple-100 text-purple-800 font-mono text-[10px] font-black flex items-center justify-center">
                        {cIdx + 1}
                      </span>
                      <span className="font-black text-slate-900 uppercase">
                        {conf.candidate_name}
                      </span>
                      {conf.candidate_cpf && (
                        <span className="font-mono text-slate-600 bg-slate-100 px-2 py-0.2 rounded text-[10px]">
                          CPF: {formatCpf(conf.candidate_cpf)}
                        </span>
                      )}
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                      conf.status === 'pendente' 
                        ? 'bg-amber-100 text-amber-900 border border-amber-200' 
                        : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                    }`}>
                      {conf.status}
                    </span>
                  </div>

                  <p className="text-slate-700 font-medium leading-relaxed bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    {conf.notes || conf.reason}
                  </p>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                    <span>Solicitado por: <strong>{conf.created_by_user_name || 'Operador'}</strong></span>
                    <span>Data: {new Date(conf.created_at).toLocaleString('pt-BR')}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

      </div>

    </div>
  );
};
