import React, { useState, useMemo } from 'react';
import {
  Shield, CheckCircle2, XCircle, Search, ChevronDown, ChevronRight,
  Power, Settings2, Monitor, Smartphone, ShoppingCart, Briefcase,
  Gavel, Calendar, Users, HeartPulse, Pill, Newspaper, Car, Fuel,
  Truck, FileText, CheckSquare, ShieldAlert, Sparkles, Layers, Check,
  AlertTriangle, Upload, UserCheck, UserX, Loader2
} from 'lucide-react';
import { MODULE_ACCESS_TREE, ModuleItemDefinition } from '../../services/permissionService';
import { User } from '../../types';

export interface ModuleAccessControlTreeProps {
  /** Escopo da árvore: global (/Admin/ControleAcesso) ou individual do usuário (/Admin/Usuarios/Editar/:id/Modulos) */
  scope: 'global' | 'user';
  /** Título do cabeçalho */
  title?: string;
  /** Subtítulo descritivo */
  subtitle?: string;
  /** Nome do usuário quando em escopo 'user' */
  targetUserName?: string;
  /** Permissões ativas no escopo 'user' (array de strings de chaves) */
  userPermissions?: string[];
  /** Status global (mapa module_key -> boolean) */
  globalStatus?: Record<string, boolean>;
  /** Status mobile no escopo global (mapa module_key -> boolean) */
  mobileGlobalStatus?: Record<string, boolean>;
  /** Callback para alternar permissão individual do usuário */
  onToggleUserPermission?: (key: string, enabled: boolean) => void;
  /** Callback para alternar status global (web ou mobile) */
  onToggleGlobalStatus?: (key: string, enabled: boolean, channel: 'web' | 'mobile') => Promise<boolean>;
  /** Lista de todos os usuários (necessário para ações universais em massa) */
  users?: User[];
  /** Callback para ação universal de Ativar / Desativar individualmente para todos os usuários */
  onBatchUpdateUserPermissions?: (key: string, enabled: boolean) => Promise<{ count: number }>;
  /** Estado de carregamento */
  isLoading?: boolean;
}

export const ModuleAccessControlTree: React.FC<ModuleAccessControlTreeProps> = ({
  scope,
  title,
  subtitle,
  targetUserName,
  userPermissions = [],
  globalStatus = {},
  mobileGlobalStatus = {},
  onToggleUserPermission,
  onToggleGlobalStatus,
  users = [],
  onBatchUpdateUserPermissions,
  isLoading = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeChannel, setActiveChannel] = useState<'web' | 'mobile'>('web');
  const [processingKey, setProcessingKey] = useState<string | null>(null);
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});

  // Estados para o modal de confirmação universal e toast
  const [batchConfirmModal, setBatchConfirmModal] = useState<{
    isOpen: boolean;
    targetKey: string;
    targetLabel: string;
    enabled: boolean;
    isSubmodule: boolean;
  } | null>(null);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchSuccessToast, setBatchSuccessToast] = useState<string | null>(null);

  // Ícone por módulo
  const renderModuleIcon = (key: string) => {
    const iconClass = "w-6 h-6 transition-transform duration-300 group-hover:scale-110";
    switch (key) {
      case 'parent_compras': return <ShoppingCart className={iconClass} />;
      case 'parent_diarias': return <Briefcase className={iconClass} />;
      case 'parent_licitacao': return <Gavel className={iconClass} />;
      case 'parent_calendario': return <Calendar className={iconClass} />;
      case 'parent_rh': return <Users className={iconClass} />;
      case 'parent_consultas': return <HeartPulse className={iconClass} />;
      case 'parent_farmacia': return <Pill className={iconClass} />;
      case 'parent_noticias': return <Newspaper className={iconClass} />;
      case 'parent_agendamento_veiculo': return <Car className={iconClass} />;
      case 'parent_abastecimento': return <Fuel className={iconClass} />;
      case 'parent_frotas': return <Truck className={iconClass} />;
      case 'parent_criar_oficio': return <FileText className={iconClass} />;
      case 'parent_tarefas': return <CheckSquare className={iconClass} />;
      case 'parent_admin': return <ShieldAlert className={iconClass} />;
      case 'parent_upload': return <Upload className={iconClass} />;
      default: return <Layers className={iconClass} />;
    }
  };

  // Helper para verificar se um item está ativado
  const isItemEnabled = (itemKey: string, legacyKeys?: string[]): boolean => {
    if (scope === 'global') {
      const statusMap = activeChannel === 'web' ? globalStatus : mobileGlobalStatus;
      if (statusMap[itemKey] === false) return false;
      if (legacyKeys && legacyKeys.length > 0) {
        if (legacyKeys.some(lk => statusMap[lk] === false)) return false;
      }
      return true;
    } else {
      // Escopo de Usuário
      if (userPermissions.includes(itemKey)) return true;
      if (legacyKeys && legacyKeys.length > 0) {
        return legacyKeys.some(lk => userPermissions.includes(lk));
      }
      return false;
    }
  };

  // Alternar permissão
  const handleToggle = async (itemKey: string, currentEnabled: boolean, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const nextValue = !currentEnabled;

    if (scope === 'global') {
      if (onToggleGlobalStatus) {
        setProcessingKey(itemKey);
        try {
          await onToggleGlobalStatus(itemKey, nextValue, activeChannel);
        } finally {
          setProcessingKey(null);
        }
      }
    } else {
      if (onToggleUserPermission) {
        onToggleUserPermission(itemKey, nextValue);
      }
    }
  };

  // Abre modal de confirmação para alteração universal individual em todos os usuários
  const openBatchModal = (key: string, label: string, enabled: boolean, isSubmodule: boolean, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setBatchConfirmModal({
      isOpen: true,
      targetKey: key,
      targetLabel: label,
      enabled,
      isSubmodule
    });
  };

  // Executa a alteração em lote para todos os usuários chamando o callback do Supabase/App
  const executeBatchUpdate = async () => {
    if (!batchConfirmModal || !onBatchUpdateUserPermissions) return;
    setIsBatchProcessing(true);
    try {
      const result = await onBatchUpdateUserPermissions(batchConfirmModal.targetKey, batchConfirmModal.enabled);
      const actionText = batchConfirmModal.enabled ? 'ativada' : 'desativada';
      const msg = `Permissão individual ${actionText} para todos os ${result.count} usuários com sucesso!`;
      setBatchSuccessToast(msg);
      setTimeout(() => setBatchSuccessToast(null), 4500);
    } catch (err: any) {
      console.error("Erro ao aplicar permissão em lote:", err);
      alert("Erro ao aplicar permissão para todos os usuários: " + (err.message || 'Falha inesperada'));
    } finally {
      setIsBatchProcessing(false);
      setBatchConfirmModal(null);
    }
  };

  const toggleExpand = (key: string) => {
    setExpandedModules(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const expandAll = () => {
    const all: Record<string, boolean> = {};
    MODULE_ACCESS_TREE.forEach(m => { all[m.key] = true; });
    setExpandedModules(all);
  };

  const collapseAll = () => {
    setExpandedModules({});
  };

  // Filtragem pela busca
  const filteredModules = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return MODULE_ACCESS_TREE;

    return MODULE_ACCESS_TREE.filter(module => {
      const matchParent =
        module.label.toLowerCase().includes(term) ||
        module.description.toLowerCase().includes(term) ||
        module.routes.some(r => r.toLowerCase().includes(term));

      const matchChildren = module.submodules?.some(sub =>
        sub.label.toLowerCase().includes(term) ||
        sub.description.toLowerCase().includes(term) ||
        sub.routes.some(r => r.toLowerCase().includes(term))
      );

      return matchParent || matchChildren;
    });
  }, [searchTerm]);

  // Contagem de permissões
  const stats = useMemo(() => {
    let totalItems = 0;
    let enabledItems = 0;

    MODULE_ACCESS_TREE.forEach(parent => {
      totalItems += 1;
      const parentOn = isItemEnabled(parent.key, parent.legacyKeys);
      if (parentOn) enabledItems += 1;

      if (parent.submodules) {
        parent.submodules.forEach(sub => {
          totalItems += 1;
          // Submódulo conta como ativo apenas se o pai estiver ativo e ele estiver ativo
          if (parentOn && isItemEnabled(sub.key, sub.legacyKeys)) {
            enabledItems += 1;
          }
        });
      }
    });

    return { totalItems, enabledItems };
  }, [scope, userPermissions, globalStatus, mobileGlobalStatus, activeChannel]);

  return (
    <div className="w-full flex flex-col space-y-6 animate-fade-in font-sans">
      {/* Header com estilo idêntico em ambas as páginas */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 bg-white p-6 rounded-3xl border border-slate-200/90 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-2xl shadow-md shadow-indigo-500/20">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                {title || (scope === 'global' ? 'Controle de Acesso Global' : `Permissões de Acesso: ${targetUserName || 'Usuário'}`)}
              </h2>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border flex items-center gap-1.5 shadow-xs ${
                scope === 'global'
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${scope === 'global' ? 'bg-indigo-500' : 'bg-emerald-500'} animate-pulse`}></span>
                {scope === 'global' ? 'Escopo Global' : 'Escopo Individual'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              {subtitle || (scope === 'global'
                ? 'Gerencie a disponibilidade geral de cada módulo e submódulo para todos os usuários do sistema.'
                : 'Configure especificamente quais módulos e funcionalidades este usuário terá autorização para acessar.')}
            </p>
          </div>
        </div>

        {/* Controles do Topo: Canal Web/Mobile no Global e Contadores */}
        <div className="flex items-center gap-3 flex-wrap self-start lg:self-auto">
          {scope === 'global' && (
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200/80">
              <button
                type="button"
                onClick={() => setActiveChannel('web')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  activeChannel === 'web'
                    ? 'bg-white text-indigo-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                Web
              </button>
              <button
                type="button"
                onClick={() => setActiveChannel('mobile')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  activeChannel === 'mobile'
                    ? 'bg-white text-rose-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                Mobile
              </button>
            </div>
          )}

          <div className="px-3.5 py-2 rounded-2xl bg-slate-50 border border-slate-200 flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-bold text-slate-700">
              <strong className="font-black text-slate-900">{stats.enabledItems}</strong> de {stats.totalItems} permissões ativas
            </span>
          </div>
        </div>
      </div>

      {/* Banner Explicativo de Regras: Controle Global vs Universal para Todos */}
      {scope === 'global' && (
        <div className="bg-gradient-to-r from-indigo-50/90 via-sky-50/70 to-slate-50 p-4 rounded-3xl border border-indigo-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs shadow-xs">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-indigo-600 text-white shrink-0 shadow-xs">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-black text-slate-900 text-sm">
                Diferença entre os Controles nesta Página
              </h4>
              <p className="text-slate-600 mt-0.5 leading-relaxed text-[11px]">
                <strong>Switch de Ativação:</strong> Define a disponibilidade global do módulo/submódulo no sistema. Se desativado, nenhum usuário acessa.<br />
                <strong>Botão Universal "Ativar / Desativar p/ Todos":</strong> Atua individualmente sobre todos os usuários sem desativar a estrutura global, alterando as permissões de cada usuário no banco e permitindo reajustes manuais pontuais depois.
              </p>
            </div>
          </div>
          {users && users.length > 0 && (
            <div className="shrink-0 px-3 py-1.5 rounded-xl bg-white border border-indigo-100 text-indigo-900 font-bold text-[11px] self-end md:self-auto flex items-center gap-1.5 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              {users.length} {users.length === 1 ? 'usuário cadastrado' : 'usuários cadastrados'}
            </div>
          )}
        </div>
      )}

      {/* Barra de Filtro, Pesquisa e Ações Rápidas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="relative flex-1 max-w-xl">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Pesquisar por módulo, funcionalidade ou rota URL (ex: /Editor/Compras)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10 transition-all outline-none text-xs md:text-sm font-medium placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            type="button"
            onClick={expandAll}
            className="px-3 py-2 text-xs font-bold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all cursor-pointer"
          >
            Expandir Todos
          </button>
          <span className="text-slate-300">|</span>
          <button
            type="button"
            onClick={collapseAll}
            className="px-3 py-2 text-xs font-bold text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all cursor-pointer"
          >
            Recolher Todos
          </button>
        </div>
      </div>

      {/* Árvore de Módulos (Cards Idênticos nas duas páginas) */}
      <div className="space-y-4">
        {filteredModules.length > 0 ? (
          filteredModules.map((parent) => {
            const isParentEnabled = isItemEnabled(parent.key, parent.legacyKeys);
            const children = parent.submodules || [];
            const isExpanded = expandedModules[parent.key] || searchTerm.trim().length > 0;
            const activeChildrenCount = children.filter(c => isItemEnabled(c.key, c.legacyKeys)).length;

            return (
              <div
                key={parent.key}
                className={`bg-white rounded-3xl border transition-all duration-300 overflow-hidden shadow-xs hover:shadow-md ${
                  isParentEnabled
                    ? 'border-slate-200/90'
                    : 'border-slate-200 bg-slate-50/40 opacity-90'
                }`}
              >
                {/* Linha do Módulo Pai */}
                <div
                  onClick={() => toggleExpand(parent.key)}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer select-none"
                >
                  <div className="flex items-start sm:items-center gap-4 min-w-0">
                    <div
                      className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all ${
                        isParentEnabled
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20'
                          : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      {renderModuleIcon(parent.key)}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h3 className={`font-black text-base md:text-lg tracking-tight ${
                          isParentEnabled ? 'text-slate-900' : 'text-slate-500 line-through decoration-slate-300'
                        }`}>
                          {parent.label}
                        </h3>

                        {children.length > 0 && (
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                            isParentEnabled
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                              : 'bg-slate-100 text-slate-400 border border-slate-200'
                          }`}>
                            {isParentEnabled ? `${activeChildrenCount}/${children.length} ativos` : 'Módulo Desativado'}
                          </span>
                        )}

                        <span className="font-mono text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                          {parent.routes[0]}
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 mt-1 line-clamp-1 font-medium">
                        {parent.description}
                      </p>
                    </div>
                  </div>

                  {/* Switch ON/OFF do Módulo Pai e Botões Universais para Todos os Usuários */}
                  <div className="flex items-center gap-3 md:gap-4 self-end sm:self-auto shrink-0 flex-wrap sm:flex-nowrap justify-end" onClick={(e) => e.stopPropagation()}>
                    {/* Botão Universal "Ativar / Desativar para todos" (apenas em escopo global) */}
                    {scope === 'global' && onBatchUpdateUserPermissions && (
                      <div className="flex items-center gap-1.5 p-1 bg-slate-100/90 rounded-2xl border border-slate-200/80">
                        <span className="hidden xl:inline-flex text-[10px] font-black uppercase tracking-wider text-slate-600 px-2 items-center gap-1">
                          <Users className="w-3.5 h-3.5 text-indigo-600" />
                          Ativar / Desativar p/ Todos:
                        </span>
                        <button
                          type="button"
                          disabled={isLoading || isBatchProcessing}
                          onClick={(e) => openBatchModal(parent.key, parent.label, true, false, e)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] md:text-[11px] font-black uppercase tracking-wider bg-white text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 border border-emerald-200/60 shadow-2xs transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                          title={`Ativar "${parent.label}" individualmente para todos os usuários`}
                        >
                          <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Ativar p/ Todos</span>
                        </button>
                        <button
                          type="button"
                          disabled={isLoading || isBatchProcessing}
                          onClick={(e) => openBatchModal(parent.key, parent.label, false, false, e)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] md:text-[11px] font-black uppercase tracking-wider bg-white text-rose-700 hover:bg-rose-50 hover:text-rose-800 border border-rose-200/60 shadow-2xs transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                          title={`Desativar "${parent.label}" individualmente para todos os usuários`}
                        >
                          <UserX className="w-3.5 h-3.5 text-rose-600" />
                          <span>Desativar p/ Todos</span>
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-3 pr-2 sm:pr-4 sm:border-r border-slate-100">
                      <span className={`text-[11px] font-black uppercase tracking-wider ${
                        isParentEnabled ? 'text-indigo-600' : 'text-slate-400'
                      }`}>
                        {isParentEnabled ? 'Ativado' : 'Desativado'}
                      </span>

                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={(e) => handleToggle(parent.key, isParentEnabled, e)}
                        className={`relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          isParentEnabled ? 'bg-indigo-600 shadow-md shadow-indigo-500/20' : 'bg-slate-200'
                        }`}
                        title={isParentEnabled ? `Desativar módulo ${parent.label}` : `Ativar módulo ${parent.label}`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                            isParentEnabled ? 'translate-x-6' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {children.length > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleExpand(parent.key)}
                        className={`p-2 rounded-xl border transition-all cursor-pointer ${
                          isExpanded
                            ? 'bg-slate-900 border-slate-900 text-white shadow-sm'
                            : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-700'
                        }`}
                        title={isExpanded ? 'Recolher submódulos' : 'Expandir submódulos'}
                      >
                        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Submódulos (Hierarquia estrita) */}
                {children.length > 0 && isExpanded && (
                  <div className="bg-slate-50/80 border-t border-slate-100 p-4 sm:p-5 animate-slide-down">
                    {!isParentEnabled && (
                      <div className="mb-4 p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold flex items-center gap-2.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                          <strong>Módulo principal desativado:</strong> Todos os submódulos abaixo estão bloqueados para acesso. Os estados individuais estão preservados e voltarão a vigorar assim que o módulo principal for ativado.
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      {children.map((child) => {
                        const isChildExplicitlyEnabled = isItemEnabled(child.key, child.legacyKeys);
                        // Dependência: o submódulo só está efetivamente ativo se o pai estiver ativo
                        const isChildEffective = isParentEnabled && isChildExplicitlyEnabled;

                        return (
                          <div
                            key={child.key}
                            className={`p-4 rounded-2xl border transition-all flex flex-col justify-between gap-3 ${
                              !isParentEnabled
                                ? 'bg-slate-100/60 border-slate-200/60 opacity-60'
                                : isChildExplicitlyEnabled
                                ? 'bg-white border-indigo-200/80 shadow-xs ring-1 ring-indigo-500/5'
                                : 'bg-white/80 border-slate-200'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex items-start gap-2.5">
                                <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                                  isChildEffective
                                    ? 'bg-indigo-50 text-indigo-600'
                                    : 'bg-slate-200 text-slate-400'
                                }`}>
                                  <Settings2 className="w-3.5 h-3.5" />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h4 className={`font-bold text-sm ${
                                      isChildEffective ? 'text-slate-900' : 'text-slate-600'
                                    }`}>
                                      {child.label}
                                    </h4>
                                  </div>
                                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                                    {child.description}
                                  </p>
                                </div>
                              </div>

                              {/* Switch do Submódulo */}
                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  disabled={!isParentEnabled || isLoading}
                                  onClick={(e) => handleToggle(child.key, isChildExplicitlyEnabled, e)}
                                  className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                                    !isParentEnabled
                                      ? 'bg-slate-200 cursor-not-allowed opacity-50'
                                      : isChildExplicitlyEnabled
                                      ? 'bg-indigo-600 shadow-sm cursor-pointer'
                                      : 'bg-slate-300 hover:bg-slate-400 cursor-pointer'
                                  }`}
                                  title={
                                    !isParentEnabled
                                      ? 'Ative o módulo principal primeiro para habilitar este submódulo'
                                      : isChildExplicitlyEnabled
                                      ? `Desativar ${child.label}`
                                      : `Ativar ${child.label}`
                                  }
                                >
                                  <span
                                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                                      isChildExplicitlyEnabled ? 'translate-x-5' : 'translate-x-0'
                                    }`}
                                  />
                                </button>
                              </div>
                            </div>

                            {/* Tags de Rotas associadas ao submódulo */}
                            <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 flex-wrap">
                              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Rotas:</span>
                              {child.routes.map(route => (
                                <span
                                  key={route}
                                  className="font-mono text-[10px] font-semibold text-slate-600 bg-slate-100/90 px-2 py-0.5 rounded-md border border-slate-200/80 truncate max-w-full"
                                  title={route}
                                >
                                  {route}
                                </span>
                              ))}
                            </div>

                            {/* Ação Universal no Submódulo: Ativar / Desativar para todos */}
                            {scope === 'global' && onBatchUpdateUserPermissions && (
                              <div
                                className="mt-1 pt-2.5 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 bg-slate-50/90 p-2.5 rounded-xl border border-slate-200/80"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex items-center gap-1.5 text-slate-700">
                                  <Users className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                  <span className="text-[11px] font-black tracking-tight text-slate-800">
                                    Ativar / Desativar para todos:
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5 w-full sm:w-auto justify-end">
                                  <button
                                    type="button"
                                    disabled={isLoading || isBatchProcessing}
                                    onClick={(e) => openBatchModal(child.key, child.label, true, true, e)}
                                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-white text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 border border-emerald-300/80 shadow-2xs transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                                    title={`Ativar submódulo "${child.label}" individualmente para todos os usuários`}
                                  >
                                    <UserCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                    <span>Ativar p/ Todos</span>
                                  </button>
                                  <button
                                    type="button"
                                    disabled={isLoading || isBatchProcessing}
                                    onClick={(e) => openBatchModal(child.key, child.label, false, true, e)}
                                    className="flex-1 sm:flex-initial flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-white text-rose-700 hover:bg-rose-50 hover:text-rose-800 border border-rose-300/80 shadow-2xs transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                                    title={`Desativar submódulo "${child.label}" individualmente para todos os usuários`}
                                  >
                                    <UserX className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                    <span>Desativar p/ Todos</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="py-16 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200 p-8">
            <Search className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-800">Nenhum módulo encontrado</h3>
            <p className="text-xs text-slate-400 mt-1">Nenhum resultado corresponde à sua pesquisa "{searchTerm}".</p>
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="mt-4 px-4 py-2 bg-indigo-50 text-indigo-600 font-bold text-xs rounded-xl hover:bg-indigo-100 transition-colors"
            >
              Limpar Filtro
            </button>
          </div>
        )}
      </div>

      {/* Modal de Confirmação de Alteração Universal em Lote */}
      {batchConfirmModal?.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="rounded-3xl bg-white shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-scale-in">
            {/* Header do Modal */}
            <div className={`p-6 text-white flex items-center justify-between ${
              batchConfirmModal.enabled
                ? 'bg-gradient-to-r from-emerald-600 to-teal-700'
                : 'bg-gradient-to-r from-rose-600 to-red-700'
            }`}>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-white/20 backdrop-blur-md">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-white/80">
                    Alteração Individual em Todos os Usuários
                  </span>
                  <h3 className="text-xl font-black tracking-tight">
                    {batchConfirmModal.enabled ? 'Ativar para Todos' : 'Desativar para Todos'}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                disabled={isBatchProcessing}
                onClick={() => setBatchConfirmModal(null)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/25 transition-all text-white cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-6 space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Item:</span>
                  <span className="text-sm font-black text-slate-900">{batchConfirmModal.targetLabel}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tipo:</span>
                  <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                    {batchConfirmModal.isSubmodule ? 'Submódulo' : 'Módulo Principal'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Ação Individual:</span>
                  <span className={`text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                    batchConfirmModal.enabled
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}>
                    {batchConfirmModal.enabled ? 'Ativar (ON)' : 'Desativar (OFF)'}
                  </span>
                </div>
              </div>

              {/* Destaque da quantidade de usuários afetados */}
              <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 font-black text-sm shadow-sm">
                  {users.length}
                </div>
                <div>
                  <h4 className="text-sm font-black text-indigo-950">
                    {users.length} {users.length === 1 ? 'usuário cadastrado será afetado' : 'usuários cadastrados serão afetados'}
                  </h4>
                  <p className="text-xs text-indigo-800/80 mt-0.5 font-medium">
                    Esta alteração será gravada individualmente no cadastro de cada usuário no banco de dados.
                  </p>
                </div>
              </div>

              {/* Nota Explicativa das Regras */}
              <div className="p-3.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-medium space-y-1">
                <p className="font-bold text-slate-700">Diferença para o controle global:</p>
                <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-500">
                  <li>O status global continuará ativo na estrutura do sistema.</li>
                  <li>O resultado é idêntico a entrar na tela de cada usuário e alterar manualmente.</li>
                  <li>A mudança aparecerá imediatamente em <code className="bg-slate-200 px-1 rounded text-slate-700">/Admin/Usuarios/Editar/:id/Modulos</code>.</li>
                </ul>
              </div>
            </div>

            {/* Rodapé de Ações */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={isBatchProcessing}
                onClick={() => setBatchConfirmModal(null)}
                className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition-all cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={isBatchProcessing}
                onClick={executeBatchUpdate}
                className={`px-5 py-2.5 rounded-xl text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all shadow-md cursor-pointer disabled:opacity-50 ${
                  batchConfirmModal.enabled
                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                    : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                }`}
              >
                {isBatchProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processando {users.length} usuários...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Confirmar para todos ({users.length})
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Flutuante de Sucesso */}
      {batchSuccessToast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md p-4 rounded-2xl bg-slate-950 text-white shadow-2xl border border-slate-800 flex items-center gap-3 animate-slide-up">
          <div className="p-2 rounded-xl bg-emerald-500 text-white shrink-0">
            <Check className="w-4 h-4" />
          </div>
          <p className="text-xs font-bold text-slate-100 flex-1">{batchSuccessToast}</p>
          <button
            type="button"
            onClick={() => setBatchSuccessToast(null)}
            className="p-1 rounded-lg text-slate-400 hover:text-white cursor-pointer"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
