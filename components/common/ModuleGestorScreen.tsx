import React, { useState, useEffect, useMemo } from 'react';
import { 
  Shield, ShieldAlert, ShieldCheck, Search, Users, ArrowLeft, 
  Check, X, Sparkles, CheckCircle2, Lock, Key, RefreshCw, Loader2,
  CheckSquare, Eye, Plus, Edit2, Trash2, CheckCircle, Database, History, Zap
} from 'lucide-react';
import { User, AppPermission } from '../../types';
import { supabase } from '../../services/supabaseClient';
import { auditLogService } from '../../services/auditLogService';

interface ModuleGestorScreenProps {
  moduleType: 'consultas' | 'farmacia';
  moduleTitle: string;
  currentUser: User | null;
  onBack: () => void;
}

interface PermissionItem {
  id: AppPermission;
  label: string;
  description: string;
  category: 'modulo' | 'tela' | 'acao';
}

export const ModuleGestorScreen: React.FC<ModuleGestorScreenProps> = ({
  moduleType,
  moduleTitle,
  currentUser,
  onBack
}) => {
  const gestorPermKey: AppPermission = moduleType === 'consultas' ? 'parent_consultas_gestor' : 'parent_farmacia_gestor';
  const hasModuleGestorPermission = currentUser?.role === 'admin' || (currentUser?.permissions || []).includes(gestorPermKey);

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [savingUserId, setSavingUserId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Definição das permissões por módulo
  const modulePermissions: PermissionItem[] = useMemo(() => {
    if (moduleType === 'consultas') {
      return [
        { id: 'parent_consultas', label: 'Visibilidade do Módulo', description: 'Acesso principal ao módulo de Regulação de Consultas', category: 'modulo' },
        { id: 'parent_consultas_novo_agendamento', label: 'Tela: Novo Agendamento', description: 'Permissão para acessar e realizar novos agendamentos', category: 'tela' },
        { id: 'parent_consultas_acompanhar', label: 'Tela: Acompanhar Agendamentos', description: 'Permissão para visualizar e filtrar agendamentos existentes', category: 'tela' },
        { id: 'parent_consultas_dados', label: 'Tela: Área de Dados & Relatórios', description: 'Permissão para acessar painéis estatísticos e exportação', category: 'tela' },
        { id: 'parent_consultas_pacientes', label: 'Tela: Gestão de Pacientes', description: 'Permissão para visualizar e administrar a base de pacientes', category: 'tela' },
        { id: 'parent_consultas_gestor', label: 'Submódulo: Gestor (Permissões)', description: 'Permissão para gerenciar acessos de outros usuários', category: 'tela' },
      ];
    } else {
      return [
        { id: 'parent_farmacia', label: 'Visibilidade do Módulo', description: 'Acesso principal ao módulo da Farmácia Popular', category: 'modulo' },
        { id: 'parent_farmacia_consultar', label: 'Tela: Consultar Medicamentos', description: 'Permissão para consultar o catálogo de remédios', category: 'tela' },
        { id: 'parent_farmacia_retirar', label: 'Tela: Retirar Medicamento', description: 'Permissão para dispensar medicamentos a pacientes', category: 'tela' },
        { id: 'parent_farmacia_estoque', label: 'Tela: Gestão de Estoque', description: 'Permissão para entrada, saída e controle de lote/validade', category: 'tela' },
        { id: 'parent_farmacia_dashboard', label: 'Tela: Dashboard & Indicadores', description: 'Permissão para estatísticas e indicadores de dispensação', category: 'tela' },
        { id: 'parent_farmacia_pacientes', label: 'Tela: Gestão de Pacientes', description: 'Permissão para visualizar pacientes atendidos pela farmácia', category: 'tela' },
        { id: 'parent_farmacia_gestor', label: 'Submódulo: Gestor (Permissões)', description: 'Permissão para gerenciar acessos de outros usuários', category: 'tela' },
        { id: 'parent_farmacia_criar', label: 'Ação: Criar / Entrada de Medicamento', description: 'Permissão para cadastrar novos itens e lotes', category: 'acao' },
        { id: 'parent_farmacia_editar', label: 'Ação: Editar Registros', description: 'Permissão para alterar dados cadastrais de medicamentos', category: 'acao' },
        { id: 'parent_farmacia_excluir', label: 'Ação: Excluir Registros', description: 'Permissão para remover dados e itens do estoque', category: 'acao' },
        { id: 'parent_farmacia_aprovar', label: 'Ação: Aprovar Dispensações', description: 'Permissão para aprovar saídas de medicamentos restritos', category: 'acao' },
      ];
    }
  }, [moduleType]);

  const allModulePermIds = useMemo(() => modulePermissions.map(p => p.id), [modulePermissions]);

  // Carregar lista de usuários
  const loadUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('profiles').select('*').order('name');
      if (error) throw error;

      if (data) {
        const mapped: User[] = data.map((u: any) => ({
          id: u.id,
          username: u.username || u.email || '',
          name: u.name || 'Usuário',
          role: u.role || 'collaborator',
          sector: u.sector || '',
          jobTitle: u.job_title || '',
          permissions: Array.isArray(u.permissions) ? u.permissions : [],
          email: u.email || '',
          avatar: u.avatar || '',
          status: u.status || 'active'
        }));

        setUsers(mapped);
        if (mapped.length > 0 && !selectedUserId) {
          setSelectedUserId(mapped[0].id);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar usuários no Gestor:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hasModuleGestorPermission) {
      loadUsers();
    }
  }, [hasModuleGestorPermission]);

  // Usuário atualmente selecionado no painel
  const selectedUser = useMemo(() => {
    return users.find(u => u.id === selectedUserId) || null;
  }, [users, selectedUserId]);

  // Verificar se o usuário selecionado tem "Acesso Total" ao módulo
  const hasFullAccess = useMemo(() => {
    if (!selectedUser) return false;
    const userPerms = selectedUser.permissions || [];
    return allModulePermIds.every(id => userPerms.includes(id));
  }, [selectedUser, allModulePermIds]);

  // Filtrar usuários por busca
  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) return users;
    const term = searchTerm.toLowerCase().trim();
    return users.filter(u => 
      u.name.toLowerCase().includes(term) || 
      u.username.toLowerCase().includes(term) ||
      (u.email || '').toLowerCase().includes(term) ||
      (u.sector || '').toLowerCase().includes(term)
    );
  }, [users, searchTerm]);

  // Alternar permissão individual de um usuário
  const toggleUserPermission = async (targetUser: User, permId: AppPermission) => {
    if (!hasModuleGestorPermission) return;

    setSavingUserId(targetUser.id);
    const currentPerms = targetUser.permissions || [];
    const isChecked = currentPerms.includes(permId);

    let updatedPerms: AppPermission[];
    if (isChecked) {
      updatedPerms = currentPerms.filter(p => p !== permId);
      // Se desmarcou o módulo pai, desmarca todos do módulo
      if (permId === 'parent_consultas' || permId === 'parent_farmacia') {
        updatedPerms = updatedPerms.filter(p => !allModulePermIds.includes(p));
      }
    } else {
      updatedPerms = [...currentPerms, permId];
      // Se marcou algum card/ação, garante que o módulo pai está marcado
      const parentKey: AppPermission = moduleType === 'consultas' ? 'parent_consultas' : 'parent_farmacia';
      if (!updatedPerms.includes(parentKey)) {
        updatedPerms.push(parentKey);
      }
    }

    await saveUserPermissions(targetUser, updatedPerms, `Permissão '${permId}' ${isChecked ? 'removida' : 'concedida'}`);
  };

  // Alternar botão "Acesso Total"
  const toggleFullAccess = async (targetUser: User) => {
    if (!hasModuleGestorPermission) return;

    setSavingUserId(targetUser.id);
    const currentPerms = targetUser.permissions || [];

    let updatedPerms: AppPermission[];
    if (hasFullAccess) {
      // Remover todas as permissões do módulo
      updatedPerms = currentPerms.filter(p => !allModulePermIds.includes(p));
    } else {
      // Adicionar todas as permissões do módulo
      const permSet = new Set([...currentPerms, ...allModulePermIds]);
      updatedPerms = Array.from(permSet);
    }

    const actionText = hasFullAccess ? 'Acesso Total Removido' : 'Acesso Total Concedido';
    await saveUserPermissions(targetUser, updatedPerms, actionText);
  };

  // Persistir alterações no Supabase e registrar Audit Log
  const saveUserPermissions = async (targetUser: User, newPermissions: AppPermission[], actionDescription: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ permissions: newPermissions })
        .eq('id', targetUser.id);

      if (error) throw error;

      // Atualizar lista local de usuários
      setUsers(prev => prev.map(u => u.id === targetUser.id ? { ...u, permissions: newPermissions } : u));

      // Registrar histórico de auditoria
      await auditLogService.logAction({
        action_type: 'GESTION_PERMISSION_UPDATE',
        module: moduleTitle,
        description: `Permissões de ${moduleTitle} alteradas para o usuário ${targetUser.name}: ${actionDescription}`,
        details: {
          admin_id: currentUser?.id,
          admin_name: currentUser?.name,
          admin_email: currentUser?.email,
          target_user_id: targetUser.id,
          target_user_name: targetUser.name,
          target_user_email: targetUser.email,
          action: actionDescription,
          updated_permissions: newPermissions,
          timestamp: new Date().toISOString()
        }
      });

      setSuccessToast(`Permissões salvas para ${targetUser.name}!`);
      setTimeout(() => setSuccessToast(null), 3000);
    } catch (err) {
      console.error('Erro ao salvar permissões no Gestor:', err);
    } finally {
      setSavingUserId(null);
    }
  };

  // BLOQUEIO DE ACESSO PARA NÃO AUTORIZADOS
  if (!hasModuleGestorPermission) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-50 min-h-screen text-center">
        <div className="w-20 h-20 rounded-3xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shadow-xl mb-5 animate-bounce">
          <ShieldAlert className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight mb-2">Acesso Restrito</h2>
        <p className="text-sm font-bold text-slate-500 max-w-md mb-6 leading-relaxed">
          Você não possui permissão para acessar a área de Gestão de Permissões do módulo <span className="text-slate-900">{moduleTitle}</span>.
        </p>
        <button
          onClick={onBack}
          className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-2xl shadow-lg active:scale-95 transition-all text-xs uppercase tracking-wider flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar ao Módulo
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50/60 overflow-hidden font-sans">
      {/* Toast de Sucesso */}
      {successToast && (
        <div className="fixed top-5 right-5 z-50 bg-emerald-600 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-2 text-xs font-black uppercase tracking-wider animate-in fade-in slide-in-from-top-4 duration-300">
          <CheckCircle className="w-4 h-4" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Cabeçalho do Submódulo Gestor */}
      <header className="bg-white border-b border-slate-200/80 px-6 py-4 flex items-center justify-between shrink-0 shadow-2xs">
        <div className="flex items-center gap-3.5">
          <button
            onClick={onBack}
            className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all active:scale-95 cursor-pointer"
            title="Voltar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
            <ShieldCheck className="w-5.5 h-5.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">
                Gestor: {moduleTitle}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-black uppercase tracking-wider">
                Controle Avançado
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-500">
              Configure dinamicamente as permissões de acesso, ações e visibilidade de cada usuário.
            </p>
          </div>
        </div>

        <button
          onClick={loadUsers}
          className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 text-xs font-bold"
          title="Recarregar usuários"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">Atualizar</span>
        </button>
      </header>

      {/* Conteúdo Principal em Duas Colunas */}
      <div className="flex-1 flex flex-col md:flex-row h-full min-h-0 overflow-hidden p-4 md:p-6 gap-6">
        
        {/* COLUNA 1: Lista de Usuários (Esquerda) */}
        <div className="w-full md:w-80 lg:w-96 bg-white rounded-3xl border border-slate-200/80 shadow-sm flex flex-col overflow-hidden shrink-0">
          {/* Header da Busca */}
          <div className="p-4 border-b border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" />
                Usuários do Sistema ({users.length})
              </h3>
            </div>

            <div className="relative w-full">
              <input
                type="text"
                placeholder="Buscar usuário por nome..."
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-9 pr-3 py-2 text-xs font-semibold placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all text-slate-900"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            </div>
          </div>

          {/* Lista de Usuários com Rolagem */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1 custom-scrollbar">
            {loading ? (
              <div className="p-8 text-center text-slate-400 flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-600" />
                <span className="text-xs font-bold">Carregando usuários...</span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <span className="text-xs font-semibold">Nenhum usuário encontrado</span>
              </div>
            ) : (
              filteredUsers.map((u) => {
                const isSelected = u.id === selectedUserId;
                const userHasModule = (u.permissions || []).includes(moduleType === 'consultas' ? 'parent_consultas' : 'parent_farmacia');
                
                return (
                  <div
                    key={u.id}
                    onClick={() => setSelectedUserId(u.id)}
                    className={`p-3 rounded-2xl cursor-pointer transition-all flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200/80 shadow-2xs'
                        : 'hover:bg-slate-50 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-9 h-9 rounded-2xl flex items-center justify-center font-black text-xs shrink-0 shadow-2xs ${
                        isSelected 
                          ? 'bg-indigo-600 text-white' 
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {u.name.substring(0, 2).toUpperCase()}
                      </div>

                      <div className="min-w-0">
                        <div className="font-extrabold text-slate-900 text-xs truncate leading-tight">
                          {u.name}
                        </div>
                        <div className="text-[10px] text-slate-400 font-semibold truncate mt-0.5">
                          {u.jobTitle || u.sector || (u.role === 'admin' ? 'Administrador' : 'Colaborador')}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {userHasModule ? (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 ring-4 ring-emerald-100" title="Módulo Ativo" />
                      ) : (
                        <span className="w-2 h-2 rounded-full bg-slate-300" title="Sem acesso ao módulo" />
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* COLUNA 2: Painel de Gerenciamento Individual (Direita) */}
        <div className="flex-1 bg-white rounded-3xl border border-slate-200/80 shadow-sm flex flex-col overflow-hidden min-h-0">
          {selectedUser ? (
            <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
              
              {/* Topo do Usuário Selecionado + Botão "Acesso Total" */}
              <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white font-black text-base flex items-center justify-center shadow-md shadow-indigo-500/20 shrink-0">
                    {selectedUser.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-black text-slate-900 tracking-tight uppercase truncate">
                        {selectedUser.name}
                      </h2>
                      {selectedUser.role === 'admin' && (
                        <span className="px-2 py-0.5 bg-amber-50 border border-amber-200 text-amber-700 text-[9px] font-black uppercase rounded-full">
                          Admin
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-slate-500 truncate">
                      {selectedUser.email || selectedUser.username} • {selectedUser.sector || 'Sem setor definido'}
                    </p>
                  </div>
                </div>

                {/* BOTÃO "ACESSO TOTAL" DESTACADO */}
                <button
                  onClick={() => toggleFullAccess(selectedUser)}
                  disabled={savingUserId === selectedUser.id}
                  className={`px-5 py-2.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2.5 shadow-md cursor-pointer shrink-0 active:scale-95 ${
                    hasFullAccess
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-emerald-500/25 hover:from-emerald-700 hover:to-teal-700 ring-2 ring-emerald-500/20'
                      : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 shadow-2xs'
                  }`}
                  title="Conceder ou remover acesso completo a todas as funções do módulo"
                >
                  <Zap className={`w-4 h-4 ${hasFullAccess ? 'text-amber-300 animate-pulse' : 'text-slate-400'}`} />
                  <span>Acesso Total {hasFullAccess ? 'Ativado' : 'Desativado'}</span>
                  {savingUserId === selectedUser.id && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                </button>
              </div>

              {/* Grid de Permissões Granulares */}
              <div className="flex-1 overflow-y-auto p-5 md:p-6 space-y-6 custom-scrollbar">
                
                {/* Seção 1: Visibilidade e Telas do Módulo */}
                <div>
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Eye className="w-4 h-4 text-indigo-500" />
                    Visibilidade de Módulo e Telas
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {modulePermissions.map((perm) => {
                      const isChecked = (selectedUser.permissions || []).includes(perm.id);

                      return (
                        <div
                          key={perm.id}
                          onClick={() => toggleUserPermission(selectedUser, perm.id)}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                            isChecked
                              ? 'bg-indigo-50/40 border-indigo-200/90 shadow-2xs hover:border-indigo-300'
                              : 'bg-slate-50/50 border-slate-200/70 hover:bg-slate-100/60'
                          }`}
                        >
                          <div className="space-y-1 min-w-0">
                            <div className="font-extrabold text-slate-900 text-xs flex items-center gap-2">
                              <span>{perm.label}</span>
                              {perm.category === 'modulo' && (
                                <span className="px-2 py-0.2 bg-indigo-100 text-indigo-800 text-[8px] font-black uppercase rounded">Principal</span>
                              )}
                            </div>
                            <p className="text-[10px] font-semibold text-slate-500 leading-tight">
                              {perm.description}
                            </p>
                          </div>

                          <div className={`w-5 h-5 rounded-lg flex items-center justify-center shrink-0 border transition-all ${
                            isChecked
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xs'
                              : 'bg-white border-slate-300 text-transparent'
                          }`}>
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Resumo de Permissões Concedidas */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
                  <h5 className="text-[11px] font-black text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-indigo-600" />
                    Status Atual das Permissões do Usuário
                  </h5>
                  <div className="flex flex-wrap gap-2">
                    {allModulePermIds.filter(id => (selectedUser.permissions || []).includes(id)).map(id => {
                      const item = modulePermissions.find(p => p.id === id);
                      return (
                        <span key={id} className="px-2.5 py-1 rounded-xl bg-white border border-slate-200 text-slate-800 font-extrabold text-[10px] uppercase shadow-2xs flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          {item?.label || id}
                        </span>
                      );
                    })}
                    {allModulePermIds.filter(id => (selectedUser.permissions || []).includes(id)).length === 0 && (
                      <span className="text-xs text-slate-400 font-semibold italic">Nenhuma permissão concedida para este módulo.</span>
                    )}
                  </div>
                </div>

              </div>

            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-400">
              <Users className="w-12 h-12 mb-3 text-slate-300" />
              <h3 className="text-base font-extrabold text-slate-700">Nenhum Usuário Selecionado</h3>
              <p className="text-xs text-slate-500 font-semibold max-w-xs mt-1">
                Selecione um usuário na lista à esquerda para configurar suas permissões dinâmicas.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
