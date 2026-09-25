import React, { useState, useEffect } from 'react';
import { RefreshCw, Play, ArrowLeft, ShieldAlert, CheckCircle2, User as UserIcon, Search, Clock, Check, ShieldCheck, ShoppingCart, Gavel, Megaphone } from 'lucide-react';
import { triggerGlobalSystemUpdate, triggerUserSystemUpdate, getUserUpdateRequests, UserUpdateRequest } from '../services/systemUpdateService';
import { supabase } from '../services/supabaseClient';
import { User } from '../types';

declare const __LATEST_COMMIT__: string | undefined;

interface SystemUpdateScreenProps {
  onBack: () => void;
  currentUser?: User;
  users?: User[];
  onUpdateTriggered?: (target: number) => void;
}

export const SystemUpdateScreen: React.FC<SystemUpdateScreenProps> = ({ onBack, currentUser, users = [], onUpdateTriggered }) => {
  const [activeTab, setActiveTab] = useState<'global' | 'individual'>('global');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isInitiating, setIsInitiating] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [translatedCommit, setTranslatedCommit] = useState<string>('Carregando notas de versão...');

  // Estados para Atualização Individual
  const [searchTerm, setSearchTerm] = useState('');
  const [userUpdateRequests, setUserUpdateRequests] = useState<Record<string, UserUpdateRequest>>({});
  const [userUpdateModal, setUserUpdateModal] = useState<{
    isOpen: boolean;
    targetUser: User | null;
  }>({ isOpen: false, targetUser: null });
  const [isUserUpdating, setIsUserUpdating] = useState(false);
  const [userSuccessName, setUserSuccessName] = useState<string | null>(null);

  useEffect(() => {
    // Sincroniza a URL para a rota permanente /Admin/Dashboard/atualizar
    if (typeof window !== 'undefined' && window.location.pathname !== '/Admin/Dashboard/atualizar') {
      window.history.pushState({}, '', '/Admin/Dashboard/atualizar');
    }
  }, []);

  // Carrega status das atualizações de usuários
  useEffect(() => {
    let isMounted = true;
    const loadRequests = async () => {
      const reqs = await getUserUpdateRequests();
      if (isMounted) setUserUpdateRequests(reqs);
    };
    loadRequests();

    const channel = supabase.channel('system-update-screen-sync')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'organization_settings', filter: 'id=eq.global_config' },
        (payload) => {
          const reqs = (payload.new?.ui_config as any)?.user_update_requests;
          if (reqs && isMounted) {
            setUserUpdateRequests(reqs);
          }
        }
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const translateCommit = async () => {
      const rawMsg = typeof __LATEST_COMMIT__ !== 'undefined' ? __LATEST_COMMIT__ : 'Atualizações de estabilidade e melhorias gerais.';
      
      const match = rawMsg.match(/^(feat|fix|chore|refactor|docs|style|perf)(?:\([^)]+\))?:\s*(.*)/i);
      
      let prefixText = '';
      let textToTranslate = rawMsg;
      
      if (match) {
        const type = match[1].toLowerCase();
        const prefixes: Record<string, string> = {
          feat: '✨ Nova funcionalidade:',
          fix: '🐛 Correção:',
          chore: '🔧 Manutenção:',
          refactor: '♻️ Refatoração:',
          docs: '📝 Documentação:',
          style: '🎨 Estilos:',
          perf: '🚀 Performance:'
        };
        prefixText = prefixes[type] || '📦 Atualização:';
        textToTranslate = match[2];
      }
      
      try {
        const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=pt&dt=t&q=${encodeURI(textToTranslate)}`);
        const data = await res.json();
        const translated = data[0].map((item: any) => item[0]).join('');
        setTranslatedCommit(prefixText ? `${prefixText} ${translated}` : translated);
      } catch (err) {
        let formatted = rawMsg;
        if (prefixText) {
          formatted = `${prefixText} ${textToTranslate}`;
        }
        setTranslatedCommit(formatted);
      }
    };
    
    translateCommit();
  }, []);

  const handleStartGlobalUpdate = async () => {
    setIsInitiating(true);
    
    try {
      const result = await triggerGlobalSystemUpdate({
        id: currentUser?.id,
        name: currentUser?.name || 'Administrador',
        role: currentUser?.role || 'admin'
      });
      
      if (result.success) {
        setIsSuccess(true);
        if (onUpdateTriggered) {
          onUpdateTriggered(result.target);
        }
        setTimeout(() => {
          onBack();
        }, 2500);
      } else {
        alert("Erro ao disparar atualização: " + (result.error || "Tente novamente."));
        setIsInitiating(false);
        setShowConfirmModal(false);
      }
    } catch (err) {
      console.error(err);
      setIsInitiating(false);
      setShowConfirmModal(false);
    }
  };

  const handleConfirmUserUpdate = async () => {
    if (!userUpdateModal.targetUser) return;
    setIsUserUpdating(true);

    try {
      const targetUser = userUpdateModal.targetUser;
      const res = await triggerUserSystemUpdate(
        { id: currentUser?.id, name: currentUser?.name, role: currentUser?.role },
        targetUser
      );

      if (res.success) {
        setUserSuccessName(targetUser.name);
        const nowIso = new Date().toISOString();
        setUserUpdateRequests(prev => ({
          ...prev,
          [targetUser.id]: {
            target: res.target,
            version: res.target,
            targetUserId: targetUser.id,
            targetUserName: targetUser.name,
            targetUserUsername: targetUser.username,
            triggeredBy: currentUser?.name || 'Administrador',
            triggeredById: currentUser?.id,
            triggeredAt: nowIso,
            status: 'pending'
          }
        }));
        setTimeout(() => {
          setUserUpdateModal({ isOpen: false, targetUser: null });
          setUserSuccessName(null);
        }, 2200);
      } else {
        alert("Erro ao atualizar usuário: " + (res.error || "Tente novamente."));
      }
    } catch (err: any) {
      alert("Erro ao solicitar atualização: " + err.message);
    } finally {
      setIsUserUpdating(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const q = searchTerm.toLowerCase();
    return (
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.username && u.username.toLowerCase().includes(q)) ||
      (u.jobTitle && u.jobTitle.toLowerCase().includes(q)) ||
      (u.sector && u.sector.toLowerCase().includes(q))
    );
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 overflow-y-auto custom-scrollbar relative">
      {/* Header com botão de retorno ao Painel */}
      <div className="p-6 pb-2 z-10 flex items-center justify-between">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-all font-bold text-xs tracking-wide bg-white/90 backdrop-blur-md px-4 py-2.5 rounded-xl border border-slate-200 shadow-xs hover:shadow-md active:scale-95 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar ao Painel
        </button>

        <span className="text-[11px] font-mono text-slate-400 bg-white/80 px-3 py-1.5 rounded-lg border border-slate-200">
          /Admin/Dashboard/atualizar
        </span>
      </div>

      {/* Seletor de Modo de Atualização: Global ou Individual */}
      <div className="max-w-xl mx-auto w-full px-4 pt-4 pb-2">
        <div className="bg-slate-200/80 p-1 rounded-2xl flex items-center shadow-inner">
          <button
            type="button"
            onClick={() => setActiveTab('global')}
            className={`flex-1 py-2.5 px-4 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'global'
                ? 'bg-white text-slate-900 shadow-md scale-100'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5 text-orange-500" />
            Atualização Global
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('individual')}
            className={`flex-1 py-2.5 px-4 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2 ${
              activeTab === 'individual'
                ? 'bg-white text-slate-900 shadow-md scale-100'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <UserIcon className="w-3.5 h-3.5 text-indigo-500" />
            Atualização por Usuário
          </button>
        </div>
      </div>

      {/* Conteúdo da Aba Selecionada */}
      {activeTab === 'global' ? (
        /* Card Central de Atualização Global */
        <div className="flex-1 flex items-center justify-center p-4 min-h-[460px]">
          <div className="w-full max-w-[480px] bg-white rounded-[2.5rem] border border-slate-200/90 shadow-2xl p-8 sm:p-12 overflow-hidden relative animate-scale-up">
            {/* Faixa superior com detalhe em degradê laranja/âmbar */}
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500"></div>
            
            <div className="flex flex-col items-center text-center">
              {/* Ícone circular grande com fundo amarelo/laranja suave */}
              <div className="w-24 h-24 sm:w-28 sm:h-28 bg-[#fef7eb] rounded-[2.2rem] flex items-center justify-center mb-8 text-[#f59e0b] ring-8 ring-amber-500/5 shadow-inner">
                <RefreshCw className="w-12 h-12 sm:w-14 sm:h-14 text-[#ea580c] animate-spin-slow stroke-[2.2]" />
              </div>

              {/* Título Principal */}
              <h2 className="text-2xl sm:text-3xl font-black text-[#0f172a] mb-4 tracking-tight uppercase leading-tight">
                Atualização Global<br />do Sistema
              </h2>
              
              {/* Texto Explicativo */}
              <p className="text-sm sm:text-base text-slate-600 font-normal mb-9 leading-relaxed max-w-[340px]">
                Esta ação disparará um alerta de <b className="font-bold text-slate-800">60 segundos</b> para todos os usuários online. Após a contagem, o recarregamento será forçado.
              </p>

              {/* Botão de Ação Primária */}
              <button
                onClick={() => setShowConfirmModal(true)}
                className="w-full flex items-center justify-center gap-3 bg-[#0f172a] hover:bg-[#ea580c] text-white font-black py-4 sm:py-4.5 px-8 rounded-2xl transition-all duration-200 active:scale-98 shadow-xl shadow-slate-900/10 uppercase tracking-widest text-xs sm:text-sm cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                Iniciar Atualização Global
              </button>

              {/* Rodapé Institucional */}
              <div className="mt-8 pt-8 border-t border-slate-100 w-full">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.25em]">
                  Prefeitura Integrada • Admin
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Seção de Atualização Individual por Usuário */
        <div className="max-w-4xl mx-auto w-full p-4 sm:p-6 space-y-4 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <UserIcon className="w-5 h-5 text-indigo-600" />
                  Atualização Individual por Usuário
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  Selecione um usuário para renovar imediatamente sua sessão e seus arquivos temporários.
                </p>
              </div>

              {/* Barra de Busca */}
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar usuário..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                />
              </div>
            </div>

            {/* Listagem de Usuários */}
            <div className="space-y-2.5 pt-2">
              {filteredUsers.map((user) => {
                const req = userUpdateRequests[user.id];
                const isCurrentUser = user.id === currentUser?.id;

                return (
                  <div
                    key={user.id}
                    className="p-3 sm:p-4 rounded-2xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-indigo-200 transition-all duration-200 shadow-xs flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black text-white shrink-0 ${
                        user.role === 'admin' ? 'bg-gradient-to-br from-indigo-500 to-purple-600' :
                        user.role === 'compras' ? 'bg-gradient-to-br from-emerald-500 to-teal-500' :
                        user.role === 'licitacao' ? 'bg-gradient-to-br from-blue-500 to-cyan-600' :
                        user.role === 'marketing' ? 'bg-gradient-to-br from-fuchsia-500 to-pink-600' :
                        'bg-gradient-to-br from-slate-700 to-slate-800'
                      }`}>
                        {(user.name || 'U').charAt(0).toUpperCase()}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h4 className="font-extrabold text-xs sm:text-sm text-slate-800 truncate">
                            {user.name}
                          </h4>
                          {user.username && (
                            <span className="text-[11px] font-bold text-slate-400">
                              (@{user.username})
                            </span>
                          )}
                          {isCurrentUser && (
                            <span className="px-1.5 py-0.2 rounded-md bg-indigo-600 text-white text-[9px] font-black uppercase tracking-wider">
                              Você
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap mt-1 text-[11px]">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${
                            user.role === 'admin' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' :
                            user.role === 'compras' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' :
                            user.role === 'licitacao' ? 'bg-blue-50 text-blue-700 border-blue-100' :
                            user.role === 'marketing' ? 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-100' :
                            'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            {user.role === 'admin' && <ShieldCheck className="w-3 h-3" />}
                            {user.role === 'compras' && <ShoppingCart className="w-3 h-3" />}
                            {user.role === 'licitacao' && <Gavel className="w-3 h-3" />}
                            {user.role === 'marketing' && <Megaphone className="w-3 h-3" />}
                            {user.role === 'collaborator' && <UserIcon className="w-3 h-3" />}
                            <span>{user.role}</span>
                          </span>

                          {user.jobTitle && (
                            <span className="text-slate-500 truncate max-w-[150px] sm:max-w-xs font-medium">
                              • {user.jobTitle}
                            </span>
                          )}

                          {/* Status discreto de atualização */}
                          {req?.status === 'pending' ? (
                            <span 
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 shadow-xs"
                              title={`Solicitado em: ${new Date(req.triggeredAt).toLocaleString('pt-BR')}`}
                            >
                              <Clock className="w-2.5 h-2.5 text-amber-500 animate-spin-slow" />
                              <span>Atualização pendente</span>
                            </span>
                          ) : req?.status === 'completed' || req?.completedAt ? (
                            <span 
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-medium text-slate-500 bg-slate-100 border border-slate-200"
                              title="Sistema atualizado"
                            >
                              <span className="flex items-center gap-1 font-bold text-slate-600">
                                <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" />
                                Atualizado
                              </span>
                              {req.completedAt && (
                                <span className="text-[9px] text-slate-400 font-normal">
                                  • {new Date(req.completedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium text-slate-400 bg-slate-50 border border-slate-150">
                              <Check className="w-2.5 h-2.5 text-slate-400" />
                              <span>Atualizado</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setUserUpdateModal({ isOpen: true, targetUser: user })}
                      className="p-2 sm:px-3.5 sm:py-2 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200/80 transition-all flex items-center gap-1.5 text-xs font-bold cursor-pointer shadow-xs active:scale-95 shrink-0"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-orange-600" />
                      <span className="hidden sm:inline">Atualizar Usuário</span>
                    </button>
                  </div>
                );
              })}

              {filteredUsers.length === 0 && (
                <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200/80 text-slate-400 text-xs font-medium">
                  Nenhum usuário encontrado para "{searchTerm}".
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DA ATUALIZAÇÃO GLOBAL */}
      {(showConfirmModal || isSuccess) && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/50 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 p-8 sm:p-10 text-center relative animate-scale-up overflow-hidden">
            {!isSuccess ? (
              <>
                <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-500 to-orange-500"></div>
                <div className="w-20 h-20 bg-amber-50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-amber-500 ring-8 ring-amber-50/70">
                  <ShieldAlert className="w-10 h-10 text-amber-600" />
                </div>

                <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">
                  Atualização Global do Sistema
                </h3>

                <p className="text-sm text-slate-600 font-medium mb-6 leading-relaxed px-2">
                  Todos os usuários serão desconectados e os arquivos temporários da aplicação serão atualizados. Utilize esta função somente quando necessário.
                </p>
                
                {/* Notas de versão */}
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-6 text-left">
                   <h4 className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                      📦 Registro de versão do sistema:
                   </h4>
                   <p className="text-xs text-slate-600 font-medium leading-relaxed italic">
                      {translatedCommit}
                   </p>
                </div>

                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleStartGlobalUpdate}
                    disabled={isInitiating}
                    className="w-full flex items-center justify-center gap-2 bg-[#0f172a] hover:bg-[#ea580c] text-white font-bold py-4 rounded-xl transition-all active:scale-95 disabled:opacity-50 text-sm cursor-pointer shadow-lg shadow-slate-900/10"
                  >
                    {isInitiating ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Disparando atualização global...
                      </>
                    ) : (
                      'Atualizar todos os usuários'
                    )}
                  </button>
                  <button
                    onClick={() => setShowConfirmModal(false)}
                    disabled={isInitiating}
                    className="w-full py-3 text-slate-500 font-bold hover:text-slate-800 transition-colors text-xs cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="absolute top-0 left-0 right-0 h-2 bg-emerald-500"></div>
                <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-emerald-500 ring-8 ring-emerald-50/70">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">
                  Atualização Disparada!
                </h3>
                <p className="text-sm text-slate-600 font-medium mb-5 leading-relaxed px-4">
                  O alerta de 60 segundos foi transmitido para todos os usuários em tempo real. Ao fim da contagem, todas as sessões e caches serão reiniciados.
                </p>
                <div className="text-xs font-bold text-emerald-700 bg-emerald-50 py-2.5 rounded-xl px-5 inline-block mb-2">
                  Retornando ao painel em instantes...
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO: ATUALIZAÇÃO INDIVIDUAL DE USUÁRIO */}
      {userUpdateModal.isOpen && userUpdateModal.targetUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 p-8 sm:p-10 text-center relative animate-scale-up overflow-hidden">
            {!userSuccessName ? (
              <>
                <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-400 via-orange-500 to-amber-600"></div>
                <div className="w-20 h-20 bg-orange-50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-orange-600 ring-8 ring-orange-50/70">
                  <RefreshCw className={`w-10 h-10 ${isUserUpdating ? 'animate-spin' : ''}`} />
                </div>

                <h3 className="text-xl sm:text-2xl font-black text-slate-900 mb-3 tracking-tight">
                  Atualizar sistema deste usuário?
                </h3>

                <p className="text-sm text-slate-600 font-medium mb-6 leading-relaxed px-2">
                  O usuário <b className="font-bold text-slate-800">{userUpdateModal.targetUser.name}</b> terá sua sessão atualizada e os arquivos temporários da aplicação serão renovados na próxima oportunidade segura.
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    disabled={isUserUpdating}
                    onClick={() => setUserUpdateModal({ isOpen: false, targetUser: null })}
                    className="flex-1 py-3.5 px-5 bg-white hover:bg-slate-100 text-slate-600 font-bold text-xs uppercase tracking-wider rounded-2xl border border-slate-200 transition-all cursor-pointer disabled:opacity-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={isUserUpdating}
                    onClick={handleConfirmUserUpdate}
                    className="flex-1 py-3.5 px-5 bg-[#0f172a] hover:bg-[#ea580c] text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-slate-900/10 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isUserUpdating ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Atualizando...</span>
                      </>
                    ) : (
                      <span>Atualizar Usuário</span>
                    )}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="absolute top-0 left-0 right-0 h-2 bg-emerald-500"></div>
                <div className="w-20 h-20 bg-emerald-50 rounded-3xl flex items-center justify-center mx-auto mb-6 text-emerald-500 ring-8 ring-emerald-50/70">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">
                  Atualização Solicitada!
                </h3>
                <p className="text-sm text-slate-600 font-medium mb-5 leading-relaxed px-4">
                  A solicitação de renovação do sistema para <b className="font-bold text-slate-800">{userSuccessName}</b> foi registrada com sucesso.
                </p>
                <div className="text-xs font-bold text-emerald-700 bg-emerald-50 py-2.5 rounded-xl px-5 inline-block">
                  Concluído
                </div>
              </>
            )}
          </div>
        </div>
      )}
      
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes scale-up {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-scale-up {
          animation: scale-up 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fade-in 0.25s ease-out forwards;
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 14s linear infinite;
        }
      `}} />
    </div>
  );
};

