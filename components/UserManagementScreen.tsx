
import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { User, UserRole, Signature, AppPermission, Job, Sector, Person } from '../types';
import {
  Plus, Search, Edit2, Trash2, ShieldCheck, Users, Save, X, Key,
  PenTool, LayoutGrid, User as UserIcon, CheckCircle2, Gavel, ShoppingCart, Briefcase, Network,
  Eye, EyeOff, RotateCcw, AlertTriangle, Clock, Lock, Copy, Check, Info, Trash, ToggleRight, ArrowLeft, RefreshCw, Megaphone, FlaskConical, Calendar,
  ChevronDown, ChevronUp, CheckSquare, Square, Filter
} from 'lucide-react';
import { googleCalendarService } from '../services/googleCalendarService';

export type UserTab = 'dados' | 'modulos' | 'assinaturas';

const TAB_SLUGS: Record<UserTab, string> = {
  dados: 'Dados',
  modulos: 'Modulos',
  assinaturas: 'Assinaturas'
};

const SLUG_TO_TAB: Record<string, UserTab> = {
  'dados': 'dados',
  'modulos': 'modulos',
  'módulos': 'modulos',
  'assinaturas': 'assinaturas'
};

const generateStrongPassword = () => {
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const num = "23456789";
  const special = "!@#$%&*";
  const all = lower + upper + num + special;

  let pass = "";
  pass += lower.charAt(Math.floor(Math.random() * lower.length));
  pass += upper.charAt(Math.floor(Math.random() * upper.length));
  pass += num.charAt(Math.floor(Math.random() * num.length));
  pass += special.charAt(Math.floor(Math.random() * special.length));

  for (let i = 4; i < 8; i++) {
    pass += all.charAt(Math.floor(Math.random() * all.length));
  }
  return pass.split('').sort(() => 0.5 - Math.random()).join('');
};

interface UserManagementScreenProps {
  users: User[];
  currentUser: User;
  onAddUser: (user: User) => void;
  onUpdateUser: (user: User) => void;
  onDeleteUser: (userId: string) => void;
  availableSignatures: Signature[];
  jobs: Job[];
  sectors: Sector[];
  persons?: Person[];
  onBack?: () => void;
}

// Subcomponente para o contador regressivo em tempo real
const TempPasswordCountdown: React.FC<{ expiresAt: number }> = ({ expiresAt }) => {
  const [timeLeft, setTimeLeft] = useState<number>(0);

  useEffect(() => {
    const calculateTime = () => {
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setTimeLeft(remaining);
    };

    calculateTime();
    const timer = setInterval(calculateTime, 1000);
    return () => clearInterval(timer);
  }, [expiresAt]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  if (timeLeft <= 0) {
    return <span className="text-rose-400 font-black animate-pulse">EXPIRADA</span>;
  }

  return (
    <span className="font-mono font-bold">
      Expira em: {minutes}:{seconds.toString().padStart(2, '0')}
    </span>
  );
};

export const UserManagementScreen: React.FC<UserManagementScreenProps> = ({
  users,
  currentUser,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  availableSignatures,
  jobs,
  sectors,
  persons = [],
  onBack
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isEditingPage, setIsEditingPage] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  // Controle de Abas na Página do Usuário (com ROTA URL individual)
  const [activeUserTab, setActiveUserTab] = useState<UserTab>('dados');

  // Estado do Componente Select de Assinaturas
  const [isSignatureSelectOpen, setIsSignatureSelectOpen] = useState(false);
  const [signatureSearch, setSignatureSearch] = useState('');
  const signatureSelectRef = useRef<HTMLDivElement>(null);

  // Estado para Diálogos Customizados (Substituindo Confirm/Alert)
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void, type: 'danger' | 'warning' | 'info' }>({
    isOpen: false, title: '', message: '', onConfirm: () => { }, type: 'info'
  });
  const [toast, setToast] = useState<{ show: boolean, message: string, type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });
  const [googleLoading, setGoogleLoading] = useState(false);
  const [isGoogleConnectModalOpen, setIsGoogleConnectModalOpen] = useState(false);
  const [connectGoogleEmail, setConnectGoogleEmail] = useState('');

  const isAdmin = currentUser.role === 'admin' || currentUser.realRole === 'admin';

  const [formData, setFormData] = useState<Partial<User>>({
    name: '',
    username: '',
    password: '',
    tempPassword: '',
    tempPasswordExpiresAt: undefined,
    role: 'collaborator',
    sector: '',
    jobTitle: '',
    allowedSignatureIds: [],
    email: '',
    whatsapp: '',
    permissions: ['parent_criar_oficio', 'parent_rh']
  });

  // Fechar dropdown de assinaturas ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (signatureSelectRef.current && !signatureSelectRef.current.contains(event.target as Node)) {
        setIsSignatureSelectOpen(false);
      }
    };
    if (isSignatureSelectOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isSignatureSelectOpen]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ ...toast, show: false }), 3000);
  };

  const sortedUsers = [...users].sort((a, b) => a.name.localeCompare(b.name));

  const finalUserList = isAdmin
    ? sortedUsers.filter(u =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.sector?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.jobTitle?.toLowerCase().includes(searchTerm.toLowerCase())
    )
    : sortedUsers.filter(u => u.id === currentUser.id);

  // Move current user to the top if they are in the list
  const filteredUsers = isAdmin
    ? [
      ...finalUserList.filter(u => u.id === currentUser.id),
      ...finalUserList.filter(u => u.id !== currentUser.id)
    ]
    : finalUserList;

  // Alternar abas com ROTA URL individual (/Admin/Usuarios/Editar/:id/:Aba ou /Admin/Usuarios/Novo/:Aba)
  const handleChangeTab = (tab: UserTab, updateUrl = true) => {
    setActiveUserTab(tab);
    if (updateUrl) {
      const tabSlug = TAB_SLUGS[tab];
      let targetUrl = '';
      if (editingUser) {
        targetUrl = `/Admin/Usuarios/Editar/${editingUser.id}/${tabSlug}`;
      } else {
        targetUrl = `/Admin/Usuarios/Novo/${tabSlug}`;
      }
      if (window.location.pathname !== targetUrl) {
        window.history.pushState({ userId: editingUser?.id, tab }, '', targetUrl);
      }
    }
  };

  // Abrir página de edição com URL individual (/Admin/Usuarios/Editar/:id/:Aba)
  const handleOpenEditUser = (user: User, updateUrl = true, initialTab: UserTab = 'dados') => {
    setShowPassword(false);
    setCopied(false);
    setEditingUser(user);
    setActiveUserTab(initialTab);
    const basePerms = user.permissions || [];
    const googleStatus = googleCalendarService.getStoredStatus(user);

    setFormData({
      ...user,
      google_connected: googleStatus.isConnected,
      google_email: googleStatus.googleEmail || user.google_email,
      google_connected_at: googleStatus.connectedAt || user.google_connected_at,
      last_google_sync_at: googleStatus.lastSyncAt || user.last_google_sync_at,
      allowedSignatureIds: user.allowedSignatureIds || [],
      permissions: basePerms,
      password: '' // Limpa campo de senha ao editar usuário existente
    });
    setIsEditingPage(true);

    if (updateUrl) {
      const tabSlug = TAB_SLUGS[initialTab];
      const url = `/Admin/Usuarios/Editar/${user.id}/${tabSlug}`;
      if (window.location.pathname !== url) {
        window.history.pushState({ userId: user.id, tab: initialTab }, '', url);
      }
    }
  };

  // Abrir página de cadastro de novo usuário com URL individual (/Admin/Usuarios/Novo/:Aba)
  const handleOpenNewUser = (updateUrl = true, initialTab: UserTab = 'dados') => {
    setShowPassword(false);
    setCopied(false);
    setEditingUser(null);
    setActiveUserTab(initialTab);
    setFormData({
      name: '',
      username: '',
      password: generateStrongPassword(),
      tempPassword: '',
      tempPasswordExpiresAt: undefined,
      role: 'collaborator',
      sector: '',
      jobTitle: '',
      allowedSignatureIds: [],
      email: '',
      whatsapp: '+55',
      permissions: ['parent_criar_oficio', 'parent_rh']
    });
    setIsEditingPage(true);

    if (updateUrl) {
      const tabSlug = TAB_SLUGS[initialTab];
      const url = `/Admin/Usuarios/Novo/${tabSlug}`;
      if (window.location.pathname !== url) {
        window.history.pushState({ tab: initialTab }, '', url);
      }
    }
  };

  // Retornar para a lista de usuários com URL /Admin/Usuarios
  const handleBackToList = () => {
    setIsEditingPage(false);
    setEditingUser(null);
    if (window.location.pathname !== '/Admin/Usuarios') {
      window.history.pushState({}, '', '/Admin/Usuarios');
    }
  };

  // Sincronização da URL individual do usuário no carregamento e em navegações (popstate)
  useEffect(() => {
    const syncFromUrl = () => {
      let rawPath = window.location.pathname;
      try { rawPath = decodeURIComponent(rawPath); } catch (e) {}
      const path = rawPath.replace(/\/$/, '') || '/';
      const searchParams = new URLSearchParams(window.location.search);
      const queryId = searchParams.get('id');

      // Detecta se a rota atual possui segmento de aba
      // Ex: /Admin/Usuarios/Editar/:id/Modulos ou /Admin/Usuarios/Novo/Assinaturas
      let detectedTab: UserTab = 'dados';
      const segments = path.split('/').filter(Boolean);
      const lastSegment = segments[segments.length - 1]?.toLowerCase();
      if (lastSegment && SLUG_TO_TAB[lastSegment]) {
        detectedTab = SLUG_TO_TAB[lastSegment];
      }

      // Detecta /Admin/Usuarios/Novo ou /Admin/Usuarios/Novo/:tab
      if (path.toLowerCase().includes('/admin/usuarios/novo') || queryId === 'novo') {
        handleOpenNewUser(false, detectedTab);
        return;
      }

      // Detecta /Admin/Usuarios/Editar/:id ou /Admin/Usuarios/Editar/:id/:tab ou /Admin/Usuarios/:id
      const editMatch = path.match(/\/admin\/usuarios\/editar\/([^/]+)(?:\/([^/]+))?/i) || path.match(/\/admin\/usuarios\/([^/]+)(?:\/([^/]+))?/i);
      if (editMatch) {
        const firstSlug = editMatch[1];
        if (firstSlug && firstSlug.toLowerCase() !== 'usuarios' && firstSlug.toLowerCase() !== 'novo') {
          const targetId = queryId || firstSlug;
          const subSegment = editMatch[2]?.toLowerCase();
          if (subSegment && SLUG_TO_TAB[subSegment]) {
            detectedTab = SLUG_TO_TAB[subSegment];
          }
          if (targetId && users.length > 0) {
            const found = users.find(u => u.id === targetId || u.username.toLowerCase() === targetId.toLowerCase());
            if (found) {
              handleOpenEditUser(found, false, detectedTab);
              return;
            }
          }
        }
      }

      // Se for a rota de listagem (/Admin/Usuarios)
      if (path.toLowerCase() === '/admin/usuarios') {
        setIsEditingPage(false);
        setEditingUser(null);
      }
    };

    syncFromUrl();
    window.addEventListener('popstate', syncFromUrl);
    return () => window.removeEventListener('popstate', syncFromUrl);
  }, [users]);

  const handleRoleChange = (newRole: UserRole) => {
    if (!isAdmin) return;

    let updatedPermissions = [...(formData.permissions || [])];

    if (newRole !== 'admin' && newRole !== 'compras') {
      // updatedPermissions filter logic removed as the permission is gone
    }



    setFormData({
      ...formData,
      role: newRole,
      permissions: updatedPermissions
    });
  };

  const toggleSignaturePermission = (sigId: string) => {
    if (!isAdmin) return;
    setFormData(prev => {
      const currentIds = prev.allowedSignatureIds || [];
      if (currentIds.includes(sigId)) {
        return { ...prev, allowedSignatureIds: currentIds.filter(id => id !== sigId) };
      } else {
        return { ...prev, allowedSignatureIds: [...currentIds, sigId] };
      }
    });
  };

  const handleSelectAllSignatures = () => {
    if (!isAdmin) return;
    setFormData(prev => ({
      ...prev,
      allowedSignatureIds: availableSignatures.map(s => s.id)
    }));
  };

  const handleClearAllSignatures = () => {
    if (!isAdmin) return;
    setFormData(prev => ({
      ...prev,
      allowedSignatureIds: []
    }));
  };

  const toggleAppPermission = (perm: AppPermission) => {
    if (!isAdmin) return;
    setFormData(prev => {
      const currentPerms = prev.permissions || [];
      const isChecking = !currentPerms.includes(perm);

      let updated = isChecking
        ? [...currentPerms, perm]
        : currentPerms.filter(p => p !== perm);

      const subPermsMap: Record<string, string[]> = {
        parent_farmacia: ['parent_farmacia_consultar', 'parent_farmacia_retirar', 'parent_farmacia_estoque', 'parent_farmacia_dashboard', 'parent_farmacia_pacientes', 'parent_farmacia_gestor'],
        parent_consultas: ['parent_consultas_novo_agendamento', 'parent_consultas_acompanhar', 'parent_consultas_dados', 'parent_consultas_pacientes', 'parent_consultas_gestor'],
        parent_agendamento_veiculo: ['parent_agendamento_veiculo_agendar', 'parent_agendamento_veiculo_meus', 'parent_agendamento_veiculo_aprovacoes', 'parent_agendamento_veiculo_dashboard'],
        parent_abastecimento: ['parent_abastecimento_novo', 'parent_abastecimento_gestao', 'parent_abastecimento_dashboard'],
        parent_frotas: ['parent_frotas_dashboard', 'parent_frotas_leve', 'parent_frotas_pesado', 'parent_frotas_acessorio'],
        parent_compras: ['parent_compras_pedidos', 'parent_compras_itens', 'parent_compras_dados'],
        parent_diarias: ['parent_diarias_editor', 'parent_diarias_historico', 'parent_diarias_novo_evento', 'parent_diarias_lancamentos', 'parent_diarias_gestores', 'parent_diarias_viajar', 'parent_diarias_adiantamento'],
        parent_licitacao: ['parent_licitacao_processos', 'parent_licitacao_triagem'],
        parent_rh: ['parent_rh_horas_extras', 'parent_rh_historico']
      };

      const parentMap: Record<string, AppPermission> = {
        parent_farmacia_consultar: 'parent_farmacia',
        parent_farmacia_retirar: 'parent_farmacia',
        parent_farmacia_estoque: 'parent_farmacia',
        parent_farmacia_dashboard: 'parent_farmacia',
        parent_farmacia_pacientes: 'parent_farmacia',
        parent_farmacia_gestor: 'parent_farmacia',
        parent_consultas_novo_agendamento: 'parent_consultas',
        parent_consultas_acompanhar: 'parent_consultas',
        parent_consultas_dados: 'parent_consultas',
        parent_consultas_pacientes: 'parent_consultas',
        parent_consultas_gestor: 'parent_consultas',
        parent_agendamento_veiculo_agendar: 'parent_agendamento_veiculo',
        parent_agendamento_veiculo_meus: 'parent_agendamento_veiculo',
        parent_agendamento_veiculo_aprovacoes: 'parent_agendamento_veiculo',
        parent_agendamento_veiculo_dashboard: 'parent_agendamento_veiculo',
        parent_abastecimento_novo: 'parent_abastecimento',
        parent_abastecimento_gestao: 'parent_abastecimento',
        parent_abastecimento_dashboard: 'parent_abastecimento',
        parent_frotas_dashboard: 'parent_frotas',
        parent_frotas_leve: 'parent_frotas',
        parent_frotas_pesado: 'parent_frotas',
        parent_frotas_acessorio: 'parent_frotas',
        parent_compras_pedidos: 'parent_compras',
        parent_compras_itens: 'parent_compras',
        parent_compras_dados: 'parent_compras',
        parent_diarias_editor: 'parent_diarias',
        parent_diarias_historico: 'parent_diarias',
        parent_diarias_novo_evento: 'parent_diarias',
        parent_diarias_lancamentos: 'parent_diarias',
        parent_diarias_gestores: 'parent_diarias',
        parent_diarias_viajar: 'parent_diarias',
        parent_diarias_adiantamento: 'parent_diarias',
        parent_licitacao_processos: 'parent_licitacao',
        parent_licitacao_triagem: 'parent_licitacao',
        parent_rh_horas_extras: 'parent_rh',
        parent_rh_historico: 'parent_rh'
      };

      if (isChecking) {
        // Se marcou um módulo pai, marca também todos os seus sub-cards
        if (subPermsMap[perm]) {
          subPermsMap[perm].forEach(sub => {
            if (!updated.includes(sub as AppPermission)) {
              updated.push(sub as AppPermission);
            }
          });
        }
        // Se marcou um card individual, garante que o módulo pai também está marcado
        const parentPerm = parentMap[perm];
        if (parentPerm && !updated.includes(parentPerm)) {
          updated.push(parentPerm);
        }
      } else {
        // Se desmarcou um módulo pai, desmarca todos os seus sub-cards
        if (subPermsMap[perm]) {
          updated = updated.filter(p => !subPermsMap[perm].includes(p));
        }
      }

      return { ...prev, permissions: updated };
    });
  };

  const handleResetPassword = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!editingUser || !isAdmin) return;

    if (editingUser.id === currentUser.id) {
      showToast("Para alterar sua própria senha, utilize o campo 'Segurança de Acesso'.", 'error');
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: "Resetar Senha",
      message: `Deseja gerar uma senha temporária de 3 minutos para "${editingUser.name}"?`,
      type: 'warning',
      onConfirm: () => {
        const charset = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let newPass = "";
        for (let i = 0; i < 8; i++) {
          newPass += charset.charAt(Math.floor(Math.random() * charset.length));
        }

        const expiry = Date.now() + (3 * 60 * 1000); // 3 minutos

        const updatedUser = {
          ...editingUser,
          tempPassword: newPass,
          tempPasswordExpiresAt: expiry,
          password: newPass, // Pass explicitly to trigger RPC update
          mustChangePassword: true // Enforce password change
        } as User;

        onUpdateUser(updatedUser);
        setFormData(prev => ({ ...prev, tempPassword: newPass, tempPasswordExpiresAt: expiry, mustChangePassword: true }));
        setCopied(false);
        setConfirmModal({ ...confirmModal, isOpen: false });
        showToast("Senha temporária gerada!");
      }
    });
  };

  const copyToClipboard = () => {
    if (formData.tempPassword) {
      navigator.clipboard.writeText(formData.tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSave = () => {
    if (!formData.name || !formData.username) {
      showToast("Por favor, preencha nome e usuário.", 'error');
      return;
    }

    if (!editingUser && !formData.password) {
      showToast("Senha é obrigatória para novos usuários.", 'error');
      return;
    }

    if (formData.password) {
      const p = formData.password;
      const isStrong = p.length >= 8 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p) && /[^A-Za-z0-9]/.test(p);
      if (!isStrong) {
        showToast("A senha fraca! Verifique os requisitos.", 'error');
        return;
      }
    }

    // Check for duplicate username
    const usernameExists = users.some(u =>
      u.username.toLowerCase() === formData.username?.toLowerCase() &&
      (!editingUser || u.id !== editingUser.id)
    );

    let finalUsername = formData.username;

    if (usernameExists) {
      if (editingUser) {
        showToast("Este nome de usuário já está em uso.", 'error');
        return;
      } else {
        // Auto-generate for new user
        let counter = 1;
        while (users.some(u => u.username.toLowerCase() === `${finalUsername}${counter}`.toLowerCase())) {
          counter++;
        }
        finalUsername = `${finalUsername}${counter}`;
        showToast(`Sigla ajustada para "${finalUsername}" para garantir unicidade.`, 'success');
      }
    }

    // Injetando agendamento caso tenha sido removido por algum erro
    const perms = formData.permissions || [];

    const userData = {
      ...formData,
      username: finalUsername, // Use the potentially modified username
      permissions: perms,
      id: editingUser ? editingUser.id : Date.now().toString(),
    } as User;

    if (editingUser) {
      onUpdateUser(userData);
      showToast("Usuário atualizado com sucesso!");
    } else {
      onAddUser(userData);
      showToast("Novo usuário cadastrado!");
    }
    handleBackToList();
  };

  const isEditingSelf = editingUser?.id === currentUser.id;
  const inputClass = "w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed";
  const selectClass = "w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all appearance-none cursor-pointer disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed";
  const labelClass = "block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 ml-1";




  return (
    <div className="flex-1 h-full bg-slate-100 p-6 overflow-auto custom-scrollbar">
      {!isEditingPage ? (
        <div className="w-full space-y-6 animate-fade-in">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              {onBack && (
                <button
                  onClick={onBack}
                  className="p-2 -ml-2 text-slate-400 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-all"
                  title="Voltar"
                >
                  <ArrowLeft className="w-6 h-6" />
                </button>
              )}
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">{isAdmin ? 'Gestão de Usuários' : 'Meu Perfil'}</h2>
            </div>
            <p className="text-slate-500 mt-1">{isAdmin ? 'Configuração de acessos e permissões da equipe.' : 'Gerencie seus dados pessoais de acesso ao sistema.'}</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => handleOpenNewUser()}
              className="px-5 py-3 bg-slate-900 hover:bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:shadow-indigo-500/30 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-5 h-5" />
              Novo Usuário
            </button>
          )}
        </div>

        {isAdmin && (
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3">
            <Search className="w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar usuário..."
              className="flex-1 bg-transparent outline-none text-slate-700 font-medium placeholder:text-slate-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        )}

        <div className="grid gap-4 animate-fade-in">
          {filteredUsers.map((user, index) => {
            const isCurrentUser = user.id === currentUser.id;
            return (
              <div
                key={user.id}
                style={{ animationDelay: `${index * 50}ms` }}
                className={`relative group overflow-hidden p-0 rounded-[2rem] border transition-all duration-300 animate-slide-up
                  ${isCurrentUser
                    ? 'bg-gradient-to-br from-indigo-50/80 to-white/50 border-indigo-200/60 shadow-lg shadow-indigo-500/10'
                    : 'bg-white/60 backdrop-blur-xl border-white/40 shadow-sm hover:shadow-xl hover:shadow-slate-200/50 hover:border-white/80'
                  }`}
              >
                {/* Decorative background flash */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 pointer-events-none" />

                <div className="relative p-6 flex flex-col md:flex-row items-center justify-between gap-6 z-10">
                  <div className="flex items-center gap-5 w-full md:w-auto">
                    {/* Avatar Moderno */}
                    <div className={`relative w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black shadow-inner overflow-hidden shrink-0 group-hover:scale-105 transition-transform duration-300
                      ${user.role === 'admin' ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white' :
                        user.role === 'compras' ? 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white' :
                          user.role === 'licitacao' ? 'bg-gradient-to-br from-blue-500 to-cyan-600 text-white' :
                            user.role === 'marketing' ? 'bg-gradient-to-br from-fuchsia-500 to-pink-600 text-white' :
                              'bg-gradient-to-br from-slate-700 to-slate-800 text-white'
                      }`}>
                      {user.avatar ? (
                        <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                      ) : (
                        user.name.charAt(0).toUpperCase()
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-lg text-slate-800 tracking-tight">{user.name}</h3>
                        <span className="text-xs font-semibold text-slate-400">(@{user.username})</span>
                        {isCurrentUser && (
                          <span className="px-2 py-0.5 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wider rounded-lg shadow-lg shadow-indigo-500/30 whitespace-nowrap">
                            Você
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border backdrop-blur-sm
                          ${user.role === 'admin' ? 'bg-indigo-50/50 text-indigo-700 border-indigo-100' :
                            user.role === 'compras' ? 'bg-emerald-50/50 text-emerald-700 border-emerald-100' :
                            user.role === 'licitacao' ? 'bg-blue-50/50 text-blue-700 border-blue-100' :
                            user.role === 'marketing' ? 'bg-fuchsia-50/50 text-fuchsia-700 border-fuchsia-100' :
                            'bg-slate-50/50 text-slate-600 border-slate-200'
                          }`}>
                          {user.role === 'admin' && <ShieldCheck className="w-3 h-3" />}
                          {user.role === 'compras' && <ShoppingCart className="w-3 h-3" />}
                          {user.role === 'licitacao' && <Gavel className="w-3 h-3" />}
                          {user.role === 'marketing' && <Megaphone className="w-3 h-3" />}
                          {user.role === 'collaborator' && <UserIcon className="w-3 h-3" />}
                          {user.role}
                        </span>

                        {user.testRole && (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200 shadow-sm">
                            <FlaskConical className="w-3 h-3 text-amber-500 animate-pulse" />
                            Teste: {user.testRole}
                          </span>
                        )}

                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-slate-100/50 text-slate-500 border border-slate-200/50">
                          {user.jobTitle || 'Sem Cargo'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions - Modernized */}
                  <div className="flex items-center gap-3 w-full md:w-auto justify-end border-t md:border-t-0 border-slate-100 pt-4 md:pt-0">
                    <button
                      onClick={() => handleOpenEditUser(user)}
                      className="group/btn relative px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-500/10 hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-2 font-bold text-xs uppercase tracking-wide cursor-pointer"
                    >
                      <Edit2 className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                      <span className="hidden sm:inline">Editar</span>
                    </button>

                    {isAdmin && user.username !== 'admin' && user.id !== currentUser.id && (
                      <button
                        onClick={() => setConfirmModal({
                          isOpen: true,
                          title: "Excluir Usuário",
                          message: `Deseja realmente remover o acesso de "${user.name}"? Esta ação é irreversível.`,
                          type: 'danger',
                          onConfirm: () => {
                            onDeleteUser(user.id);
                            showToast("Usuário removido.");
                            setConfirmModal({ ...confirmModal, isOpen: false });
                          }
                        })}
                        className="group/btn relative px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 hover:shadow-lg hover:shadow-red-500/10 hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-2 font-bold text-xs uppercase tracking-wide"
                        title="Remover Acesso"
                      >
                        <Trash2 className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                        <span className="hidden sm:inline">Excluir</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    ) : (
        /* PÁGINA COMPLETA DE EDIÇÃO/CADASTRO DO USUÁRIO */
        <div className="w-full max-w-6xl mx-auto space-y-6 animate-fade-in pb-12">
          {/* Header Superior da Página de Edição */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={handleBackToList}
                className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl transition-all flex items-center justify-center cursor-pointer hover:-translate-x-0.5 shadow-sm"
                title="Voltar para Lista de Usuários"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100 flex items-center gap-1.5 shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></span>
                    {editingUser ? `/Admin/Usuarios/Editar/${editingUser.id}/${TAB_SLUGS[activeUserTab]}` : `/Admin/Usuarios/Novo/${TAB_SLUGS[activeUserTab]}`}
                  </span>
                  {editingUser && isAdmin && currentUser.id !== editingUser.id && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, status: formData.status === 'blocked' ? 'active' : 'blocked' })}
                      className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer ${
                        formData.status === 'blocked'
                          ? 'bg-rose-100 text-rose-700 hover:bg-rose-200 hover:shadow-md'
                          : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                      }`}
                    >
                      {formData.status === 'blocked' ? 'Desbloquear Usuário' : 'Bloquear Usuário'}
                    </button>
                  )}
                </div>
                <h2 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight mt-1.5">
                  {isAdmin ? (editingUser ? `Editar: ${editingUser.name}` : 'Novo Usuário') : 'Meu Perfil'}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-3 self-end md:self-auto">
              <button
                type="button"
                onClick={handleBackToList}
                className="px-5 py-2.5 font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-6 py-2.5 bg-slate-900 text-white font-bold rounded-xl hover:bg-indigo-600 shadow-lg hover:shadow-indigo-500/20 flex items-center gap-2 transition-all cursor-pointer text-sm"
              >
                <Save className="w-4 h-4" />
                {isAdmin ? 'Salvar Usuário' : 'Salvar Alterações'}
              </button>
            </div>
          </div>

          {/* Barra de Navegação por Abas (Nova ROTA URL para cada aba) */}
          <div className="flex items-center gap-2 p-1.5 bg-slate-200/60 backdrop-blur-md rounded-2xl border border-slate-300/60 shadow-inner max-w-full overflow-x-auto custom-scrollbar">
            <button
              type="button"
              onClick={() => handleChangeTab('dados')}
              className={`flex items-center gap-2.5 px-6 py-3 rounded-xl font-bold text-sm transition-all duration-200 shrink-0 cursor-pointer ${
                activeUserTab === 'dados'
                  ? 'bg-white text-indigo-700 shadow-md shadow-slate-200 ring-1 ring-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <UserIcon className={`w-4 h-4 ${activeUserTab === 'dados' ? 'text-indigo-600' : 'text-slate-400'}`} />
              <span>Dados</span>
            </button>

            <button
              type="button"
              onClick={() => handleChangeTab('modulos')}
              className={`flex items-center gap-2.5 px-6 py-3 rounded-xl font-bold text-sm transition-all duration-200 shrink-0 cursor-pointer ${
                activeUserTab === 'modulos'
                  ? 'bg-white text-indigo-700 shadow-md shadow-slate-200 ring-1 ring-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <LayoutGrid className={`w-4 h-4 ${activeUserTab === 'modulos' ? 'text-indigo-600' : 'text-slate-400'}`} />
              <span>Módulos Autorizados</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-black transition-colors ${
                activeUserTab === 'modulos' 
                  ? 'bg-indigo-100 text-indigo-700' 
                  : 'bg-slate-300/80 text-slate-700'
              }`}>
                {formData.permissions?.length || 0}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleChangeTab('assinaturas')}
              className={`flex items-center gap-2.5 px-6 py-3 rounded-xl font-bold text-sm transition-all duration-200 shrink-0 cursor-pointer ${
                activeUserTab === 'assinaturas'
                  ? 'bg-white text-indigo-700 shadow-md shadow-slate-200 ring-1 ring-slate-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <PenTool className={`w-4 h-4 ${activeUserTab === 'assinaturas' ? 'text-indigo-600' : 'text-slate-400'}`} />
              <span>Assinaturas</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-black transition-colors ${
                activeUserTab === 'assinaturas' 
                  ? 'bg-indigo-100 text-indigo-700' 
                  : 'bg-slate-300/80 text-slate-700'
              }`}>
                {(formData.allowedSignatureIds || []).length}
              </span>
            </button>
          </div>

          {/* ABA: DADOS */}
          {activeUserTab === 'dados' && (
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 md:p-7 space-y-6 animate-fade-in">
                {/* Seleção de Avatar Compacta */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className={labelClass}>Avatar (Monarquia/Medieval 3D)</label>
                    <span className="text-[11px] text-slate-400 font-medium">Role para o lado para ver todos</span>
                  </div>
                  <div className="flex gap-2.5 overflow-x-auto pb-2 custom-scrollbar snap-x items-center">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map(num => {
                      const avatarUrl = `/avatars/avatar${num}.png`;
                      const isSelected = formData.avatar === avatarUrl;
                      return (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setFormData({ ...formData, avatar: avatarUrl })}
                          className={`relative shrink-0 w-14 h-14 rounded-2xl border-2 transition-all duration-200 snap-center cursor-pointer ${
                            isSelected 
                              ? 'border-pink-600 scale-105 shadow-md shadow-pink-500/20' 
                              : 'border-slate-200 hover:border-slate-300 hover:scale-105 opacity-80 hover:opacity-100'
                          }`}
                        >
                          <img src={avatarUrl} alt={`Avatar ${num}`} className="w-full h-full object-cover rounded-[0.9rem] bg-slate-900" />
                          {isSelected && (
                            <div className="absolute -bottom-1 -right-1 bg-pink-600 text-white rounded-full p-0.5 border-2 border-white shadow-xs">
                              <CheckCircle2 className="w-3 h-3" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, avatar: '' })}
                      className={`relative shrink-0 w-14 h-14 rounded-2xl border-2 transition-all duration-200 snap-center flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                        !formData.avatar || formData.avatar === ''
                          ? 'border-slate-500 scale-105 shadow-md shadow-slate-500/10 bg-slate-100 text-slate-700' 
                          : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:scale-105 opacity-80 hover:opacity-100 text-slate-400 hover:text-slate-600'
                      }`}
                      title="Remover Avatar"
                    >
                      <UserIcon className="w-4 h-4" />
                      <span className="text-[8px] font-black uppercase tracking-tight">Sem Foto</span>
                      {(!formData.avatar || formData.avatar === '') && (
                        <div className="absolute -bottom-1 -right-1 bg-slate-600 text-white rounded-full p-0.5 border-2 border-white shadow-xs">
                          <CheckCircle2 className="w-3 h-3" />
                        </div>
                      )}
                    </button>
                  </div>
                </div>

                {/* Tipo de Perfil Compacto */}
                <div className="space-y-2 pt-3 border-t border-slate-100">
                  <label className={labelClass}>Tipo de Perfil</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                    {[
                      { id: 'admin', label: 'Admin', desc: 'Acesso total', icon: <ShieldCheck className="w-4 h-4" />, color: 'indigo' },
                      { id: 'compras', label: 'Compras', desc: 'Módulos + Visão', icon: <ShoppingCart className="w-4 h-4" />, color: 'emerald' },
                      { id: 'licitacao', label: 'Licitação', desc: 'Licitação', icon: <Gavel className="w-4 h-4" />, color: 'blue' },
                      { id: 'marketing', label: 'Marketing', desc: 'Gestão de mídia', icon: <Megaphone className="w-4 h-4" />, color: 'fuchsia' },
                      { id: 'collaborator', label: 'Colaborador', desc: 'Operação básica', icon: <UserIcon className="w-4 h-4" />, color: 'slate' }
                    ].map((role) => {
                      const isSelected = formData.role === role.id;
                      const canEditRole = isAdmin;

                      return (
                        <button
                          key={role.id}
                          type="button"
                          disabled={!canEditRole}
                          onClick={() => handleRoleChange(role.id as UserRole)}
                          className={`relative px-3 py-2 rounded-xl border-2 text-left transition-all duration-200 flex items-center gap-2.5 ${isSelected
                            ? `bg-${role.color}-50 border-${role.color}-600 ring-2 ring-${role.color}-600/10 shadow-xs`
                            : `bg-white border-slate-200 hover:border-slate-300 ${!canEditRole ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`
                            }`}
                        >
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                            isSelected ? `bg-${role.color}-600 text-white` : `bg-slate-100 text-slate-500`
                          }`}>
                            {role.icon}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className={`font-black text-xs truncate ${isSelected ? `text-${role.color}-950` : 'text-slate-800'}`}>
                              {role.label}
                            </h4>
                            <p className="text-[9px] text-slate-400 font-medium truncate leading-none mt-0.5">
                              {role.desc}
                            </p>
                          </div>
                          {isSelected && (
                            <CheckCircle2 className={`w-3.5 h-3.5 text-${role.color}-600 shrink-0 ml-auto`} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Tipo de Perfil Teste Compacto (Apenas para Administradores) */}
                {isAdmin && (
                  <div className="space-y-2 pt-3 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <label className={labelClass}>Tipo de Perfil Teste</label>
                        <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
                          (Simular visualização de outro perfil)
                        </span>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                        <FlaskConical className="w-3 h-3 text-amber-500" />
                        Apenas Administradores
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                      {[
                        { id: '', label: 'Sem Teste', desc: 'Perfil real', icon: <RotateCcw className="w-4 h-4" />, color: 'slate' },
                        { id: 'admin', label: 'Admin', desc: 'Como Admin', icon: <ShieldCheck className="w-4 h-4" />, color: 'indigo' },
                        { id: 'compras', label: 'Compras', desc: 'Como Compras', icon: <ShoppingCart className="w-4 h-4" />, color: 'emerald' },
                        { id: 'licitacao', label: 'Licitação', desc: 'Como Licitação', icon: <Gavel className="w-4 h-4" />, color: 'blue' },
                        { id: 'marketing', label: 'Marketing', desc: 'Como Marketing', icon: <Megaphone className="w-4 h-4" />, color: 'fuchsia' },
                        { id: 'collaborator', label: 'Colaborador', desc: 'Como Colaborador', icon: <UserIcon className="w-4 h-4" />, color: 'slate' }
                      ].map((tRole) => {
                        const isSelected = (!formData.testRole && tRole.id === '') || formData.testRole === tRole.id;

                        return (
                          <button
                            key={tRole.id || 'none'}
                            type="button"
                            onClick={() => setFormData({ ...formData, testRole: (tRole.id as UserRole) || null })}
                            className={`relative px-2.5 py-2 rounded-xl border-2 text-left transition-all duration-200 flex items-center gap-2 cursor-pointer ${isSelected
                              ? `bg-${tRole.color}-50 border-${tRole.color}-600 ring-2 ring-${tRole.color}-600/10 shadow-xs`
                              : 'bg-white border-slate-200 hover:border-slate-300'
                              }`}
                          >
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                              isSelected ? `bg-${tRole.color}-600 text-white` : 'bg-slate-100 text-slate-500'
                            }`}>
                              {tRole.icon}
                            </div>
                            <div className="min-w-0 flex-1">
                              <h4 className={`font-black text-xs truncate ${isSelected ? `text-${tRole.color}-950` : 'text-slate-800'}`}>
                                {tRole.label}
                              </h4>
                              <p className="text-[9px] text-slate-400 font-medium truncate leading-none mt-0.5">
                                {tRole.desc}
                              </p>
                            </div>
                            {isSelected && (
                              <CheckCircle2 className={`w-3.5 h-3.5 text-${tRole.color}-600 shrink-0 ml-auto`} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                  <div className="md:col-span-2">
                    <label className={labelClass}>Nome Completo</label>
                    {persons && persons.length > 0 ? (
                      <div className="relative group">
                        <div className="relative">
                          <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => {
                              const newVal = e.target.value;

                              // Helper to generate acronym
                              const generateAcronym = (name: string) => {
                                const parts = name.trim().toUpperCase().split(/\s+/).filter(p => p.length > 0);
                                if (parts.length === 0) return '';
                                if (parts.length >= 3) return parts[0][0] + parts[1][0] + parts[2][0];
                                if (parts.length === 2) return parts[0][0] + parts[1][0] + parts[0][0];
                                return parts[0].substring(0, 3);
                              };

                              const newUsername = generateAcronym(newVal);

                              setFormData(prev => ({ ...prev, name: newVal, username: newUsername }));

                              // Auto-fill if exact match found
                              const match = persons.find(p => p.name.toLowerCase() === newVal.toLowerCase());
                              if (match) {
                                // Lookup names from IDs
                                const foundSector = match.sectorId ? sectors.find(s => s.id === match.sectorId)?.name : undefined;
                                const foundJob = match.jobId ? jobs.find(j => j.id === match.jobId)?.name : undefined;

                                setFormData(prev => ({
                                  ...prev,
                                  sector: foundSector || prev.sector,
                                  jobTitle: foundJob || prev.jobTitle
                                }));
                              }
                            }}
                            className={`${inputClass} pr-10 cursor-pointer`}
                            placeholder="Comece a digitar para buscar..."
                            // list="persons-list" // Removed to prevent native dropdown conflict
                            disabled={!isAdmin && !isEditingSelf}
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                            <Search className="w-4 h-4" />
                          </div>
                        </div>

                        {/* Hidden native datalist REMOVED to solve "black select" issue */}
                        {/* Custom Dropdown Suggestion */}
                        <div className="absolute left-0 top-full mt-1 w-full bg-white rounded-xl shadow-xl border border-slate-100 max-h-48 overflow-y-auto hidden group-focus-within:block z-50 custom-scrollbar animate-slide-up">
                          {persons.filter(p => p.name.toLowerCase().includes((formData.name || '').toLowerCase()) && p.name !== formData.name).length > 0 ? (
                            persons.filter(p => p.name.toLowerCase().includes((formData.name || '').toLowerCase()) && p.name !== formData.name).map(p => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  const foundSector = p.sectorId ? sectors.find(s => s.id === p.sectorId)?.name : undefined;
                                  const foundJob = p.jobId ? jobs.find(j => j.id === p.jobId)?.name : undefined;
                                  const generateAcronym = (name: string) => {
                                    const parts = name.trim().toUpperCase().split(/\s+/).filter(p => p.length > 0);
                                    if (parts.length === 0) return '';
                                    if (parts.length >= 3) return parts[0][0] + parts[1][0] + parts[2][0];
                                    if (parts.length === 2) return parts[0][0] + parts[1][0] + parts[0][0];
                                    return parts[0].substring(0, 3);
                                  };
                                  const newUsername = generateAcronym(p.name);

                                  setFormData(prev => ({
                                    ...prev,
                                    name: p.name,
                                    username: newUsername,
                                    sector: foundSector || prev.sector,
                                    jobTitle: foundJob || prev.jobTitle
                                  }));
                                }}
                                className="w-full text-left px-4 py-3 hover:bg-indigo-50 text-slate-700 text-sm font-medium border-b border-slate-50 last:border-0 flex items-center justify-between group/item transition-colors"
                              >
                                <span className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold">
                                    {p.name.charAt(0)}
                                  </div>
                                  {p.name}
                                </span>
                                <span className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider opacity-0 group-hover/item:opacity-100 transition-opacity">Selecionar</span>
                              </button>
                            ))
                          ) : (
                            formData.name && persons.every(p => p.name !== formData.name) && (
                              <div className="p-4 text-center text-slate-400 text-sm italic">
                                Nenhuma pessoa encontrada.
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    ) : (
                      <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className={inputClass} placeholder="Ex: Nome do Colaborador" />
                    )}
                  </div>
                  <div>
                    <label className={labelClass}>Usuário de Acesso</label>

                    <input value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value.toUpperCase() })} className={inputClass} disabled={(!editingUser || !isAdmin)} placeholder="ex: AAA" />
                  </div>

                  <div>
                    <label className={labelClass}>Email</label>
                    <input
                      type="email"
                      value={formData.email || ''}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                      className={inputClass}
                      placeholder="ex: usuario@exemplo.com"
                    />
                  </div>

                  <div>
                    <label className={labelClass}>WhatsApp</label>
                    <input
                      type="text"
                      value={formData.whatsapp || ''}
                      onChange={(e) => {
                        let val = e.target.value.replace(/\D/g, '');
                        // Mask: +00 00 0 0000-0000 (13 digits)
                        // +CC DD D NNNN-NNNN (e.g. +55 31 9 8888-8888)

                        if (val.length > 13) val = val.slice(0, 13);

                        let formatted = '';
                        if (val.length > 0) formatted += '+' + val.slice(0, 2); // CC
                        if (val.length > 2) formatted += ' ' + val.slice(2, 4); // DDD
                        if (val.length > 4) formatted += ' ' + val.slice(4, 5); // 9
                        if (val.length > 5) formatted += ' ' + val.slice(5, 9); // First 4
                        if (val.length > 9) formatted += '-' + val.slice(9, 13); // Last 4

                        setFormData({ ...formData, whatsapp: formatted });
                      }}
                      className={inputClass}
                      placeholder="+55 00 0 0000-0000"
                    />
                  </div>

                  <div>
                    <label className={labelClass}>Segurança de Acesso</label>
                    {isEditingSelf || !editingUser ? (
                      <>
                        <div className="relative">
                          <input
                            type={showPassword ? "text" : "password"}
                            value={formData.password}
                            onChange={e => setFormData({ ...formData, password: e.target.value })}
                            className={`${inputClass} pr-24`}
                            placeholder="Digite a senha"
                          />
                          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                const newPass = generateStrongPassword();
                                setFormData(prev => ({ ...prev, password: newPass }));
                              }}
                              className="text-slate-400 hover:text-cyan-600 transition-colors"
                              title="Gerar nova senha forte"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="text-slate-400 hover:text-indigo-600 transition-colors"
                            >
                              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                          </div>
                        </div>

                        {/* Password Strength Checklist */}
                        <div className="grid grid-cols-2 gap-2 mt-3 pl-1">
                          {[
                            { valid: (formData.password?.length || 0) >= 8, label: "Mínimo 8 caracteres" },
                            { valid: /[A-Z]/.test(formData.password || ''), label: "Letra Maiúscula" },
                            { valid: /[a-z]/.test(formData.password || ''), label: "Letra Minúscula" },
                            { valid: /[0-9]/.test(formData.password || ''), label: "Número" },
                            { valid: /[^A-Za-z0-9]/.test(formData.password || ''), label: "Caractere Especial" }
                          ].map((req, idx) => (
                            <div key={idx} className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider ${req.valid ? 'text-emerald-600' : 'text-slate-400'}`}>
                              {req.valid ? <CheckCircle2 className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border-2 border-slate-300" />}
                              {req.label}
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="space-y-3">
                        <div className="bg-slate-100 rounded-xl p-3 border border-slate-200 flex items-center gap-3 text-slate-400 italic text-xs">
                          <Lock className="w-4 h-4" /> Senha protegida (visível apenas ao usuário)
                        </div>

                        {isAdmin && (
                          <button
                            type="button"
                            onClick={handleResetPassword}
                            className="w-full py-3 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-100 transition-all flex items-center justify-center gap-2 shadow-sm hover:shadow-md active:scale-[0.98]"
                          >
                            <RotateCcw className="w-4 h-4" /> Resetar para Senha Temporária
                          </button>
                        )}

                        {formData.tempPassword && formData.tempPasswordExpiresAt && (
                          <div className="p-5 bg-gradient-to-br from-amber-600 to-amber-700 rounded-2xl text-white shadow-xl animate-slide-up border border-white/20 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                              <Key className="w-16 h-16" />
                            </div>

                            <div className="relative z-10 flex flex-col gap-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <AlertTriangle className="w-4 h-4 text-amber-200" />
                                  <span className="text-[10px] font-black uppercase tracking-widest">Nova Senha Gerada</span>
                                </div>
                                <button
                                  onClick={copyToClipboard}
                                  className="flex items-center gap-1.5 px-2 py-1 bg-white/10 hover:bg-white/20 rounded-lg transition-all text-[9px] font-bold uppercase tracking-wider"
                                >
                                  {copied ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
                                  {copied ? 'Copiado!' : 'Copiar'}
                                </button>
                              </div>

                              <div className="bg-white/10 backdrop-blur-md p-3 rounded-xl flex items-center justify-center border border-white/10 shadow-inner">
                                <span className="font-mono text-2xl font-black tracking-[0.2em]">{formData.tempPassword}</span>
                              </div>

                              <div className="flex items-center justify-between border-t border-white/10 pt-3">
                                <div className="flex items-center gap-2 text-amber-100">
                                  <Clock className="w-4 h-4" />
                                  <TempPasswordCountdown expiresAt={formData.tempPasswordExpiresAt} />
                                </div>
                                <span className="text-[9px] font-medium text-amber-200/60 italic">Troca obrigatória no login</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="relative">
                    <label className={labelClass}>Cargo / Função</label>
                    <div className="relative group">
                      <div className="relative">
                        <input
                          type="text"
                          value={formData.jobTitle}
                          onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
                          className={`${inputClass} pr-10 cursor-pointer`}
                          placeholder={!editingUser ? "Preenchimento Automático" : "Selecione ou digite um cargo"}
                          disabled={(!editingUser || !isAdmin)}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                          <Briefcase className="w-4 h-4" />
                        </div>
                      </div>

                      {/* Custom Dropdown for Jobs */}
                      <div className="absolute left-0 top-full mt-1 w-full bg-white rounded-xl shadow-xl border border-slate-100 max-h-48 overflow-y-auto hidden group-focus-within:block z-50 custom-scrollbar animate-slide-up">
                        {jobs.filter(j => j.name.toLowerCase().includes((formData.jobTitle || '').toLowerCase()) && j.name !== formData.jobTitle).length > 0 ? (
                          jobs.filter(j => j.name.toLowerCase().includes((formData.jobTitle || '').toLowerCase()) && j.name !== formData.jobTitle)
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map(j => (
                              <button
                                key={j.id}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault(); // Prevent blur
                                  setFormData(prev => ({ ...prev, jobTitle: j.name }));
                                }}
                                className="w-full text-left px-4 py-3 hover:bg-indigo-50 text-slate-700 text-sm font-medium border-b border-slate-50 last:border-0 flex items-center justify-between group/item transition-colors"
                              >
                                <span className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold">
                                    <Briefcase className="w-3 h-3" />
                                  </div>
                                  {j.name}
                                </span>
                                <span className="text-[10px] text-indigo-600 font-bold uppercase tracking-wider opacity-0 group-hover/item:opacity-100 transition-opacity">Selecionar</span>
                              </button>
                            ))
                        ) : (
                          formData.jobTitle && jobs.every(j => j.name !== formData.jobTitle) && (
                            <div className="p-4 text-center text-slate-400 text-sm italic">
                              Nenhum cargo encontrado.
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="relative">
                    <label className={labelClass}>Setor</label>
                    <div className="relative group">
                      <div className="relative">
                        <input
                          type="text"
                          value={formData.sector}
                          onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
                          className={`${inputClass} pr-10 cursor-pointer`}
                          placeholder={!editingUser ? "Preenchimento Automático" : "Selecione ou digite um setor"}
                          disabled={(!editingUser || !isAdmin)}
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                          <Network className="w-4 h-4" />
                        </div>
                      </div>

                      {/* Custom Dropdown for Sectors */}
                      <div className="absolute left-0 top-full mt-1 w-full bg-white rounded-xl shadow-xl border border-slate-100 max-h-48 overflow-y-auto hidden group-focus-within:block z-50 custom-scrollbar animate-slide-up">
                        {sectors.filter(s => s.name.toLowerCase().includes((formData.sector || '').toLowerCase()) && s.name !== formData.sector).length > 0 ? (
                          sectors.filter(s => s.name.toLowerCase().includes((formData.sector || '').toLowerCase()) && s.name !== formData.sector)
                            .sort((a, b) => a.name.localeCompare(b.name))
                            .map(s => (
                              <button
                                key={s.id}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault(); // Prevent blur
                                  setFormData(prev => ({ ...prev, sector: s.name }));
                                }}
                                className="w-full text-left px-4 py-3 hover:bg-emerald-50 text-slate-700 text-sm font-medium border-b border-slate-50 last:border-0 flex items-center justify-between group/item transition-colors"
                              >
                                <span className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px] font-bold">
                                    <Network className="w-3 h-3" />
                                  </div>
                                  {s.name}
                                </span>
                                <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider opacity-0 group-hover/item:opacity-100 transition-opacity">Selecionar</span>
                              </button>
                            ))
                        ) : (
                          formData.sector && sectors.every(s => s.name !== formData.sector) && (
                            <div className="p-4 text-center text-slate-400 text-sm italic">
                              Nenhum setor encontrado.
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Seção: Integração com Google Agenda */}
                <div className="border-t border-slate-100 pt-6">
                  <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-50 to-indigo-50/30 border border-slate-200/80 shadow-sm space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-white border border-slate-200 text-indigo-600 shadow-sm">
                          <Calendar className="w-6 h-6" />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
                            Integração com Google Agenda
                            {formData.google_connected ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                Conectado
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-slate-100 text-slate-500 border border-slate-200">
                                Não Conectado
                              </span>
                            )}
                          </h4>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Sincronize automaticamente os eventos do sistema com a conta pessoal do Google Agenda.
                          </p>
                        </div>
                      </div>

                      {/* Botões de Ação */}
                      <div className="flex items-center gap-2 shrink-0">
                        {formData.google_connected ? (
                          <>
                            <button
                              type="button"
                              disabled={googleLoading}
                              onClick={async () => {
                                setGoogleLoading(true);
                                const res = await googleCalendarService.syncAllUserEvents(formData as User);
                                setGoogleLoading(false);
                                setFormData(prev => ({ ...prev, last_google_sync_at: new Date().toISOString() }));
                                showToast(`${res.syncedCount} evento(s) sincronizado(s) com o Google Agenda!`);
                              }}
                              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 ${googleLoading ? 'animate-spin' : ''}`} />
                              Sincronizar Agora
                            </button>

                            <button
                              type="button"
                              disabled={googleLoading}
                              onClick={async () => {
                                if (!formData.id) return;
                                setGoogleLoading(true);
                                await googleCalendarService.disconnectAccount(formData.id);
                                setGoogleLoading(false);
                                setFormData(prev => ({ ...prev, google_connected: false, google_email: undefined }));
                                showToast('Conta Google Agenda desconectada.');
                              }}
                              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold flex items-center gap-1.5 active:scale-95 transition-all cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                              Desconectar
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            disabled={googleLoading}
                            onClick={() => {
                              setConnectGoogleEmail(formData.email || (formData.username ? `${formData.username.toLowerCase()}@saojosedogoiabal.mg.gov.br` : ''));
                              setIsGoogleConnectModalOpen(true);
                            }}
                            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-extrabold flex items-center gap-2 shadow-md shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer uppercase tracking-wider"
                          >
                            <Calendar className="w-4 h-4" />
                            Conectar Google Agenda
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Detalhes de Conexão */}
                    {formData.google_connected && (
                      <div className="pt-3 border-t border-slate-200/60 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Conta Vinculada</span>
                          <span className="font-bold text-slate-700 truncate block">{formData.google_email || 'Não informado'}</span>
                        </div>
                        <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Data de Conexão</span>
                          <span className="font-bold text-slate-700 block">
                            {formData.google_connected_at ? new Date(formData.google_connected_at).toLocaleDateString('pt-BR') : 'Hoje'}
                          </span>
                        </div>
                        <div className="bg-white p-2.5 rounded-xl border border-slate-100">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Última Sincronização</span>
                          <span className="font-bold text-slate-700 block">
                            {formData.last_google_sync_at ? new Date(formData.last_google_sync_at).toLocaleString('pt-BR') : 'Agora'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

          {/* ABA: MÓDULOS AUTORIZADOS */}
          {activeUserTab === 'modulos' && (
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 md:p-10 space-y-8 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                      <LayoutGrid className="w-5 h-5" />
                    </div>
                    Módulos Autorizados
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Habilite ou restrinja o acesso aos módulos e fluxos operacionais do sistema para este usuário.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-3 py-1.5 rounded-xl text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center gap-2 shadow-sm">
                    <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                    {formData.permissions?.length || 0} permissão(ões) ativa(s)
                  </span>
                </div>
              </div>

                  <div className="space-y-6">
                    {[
                      {
                        title: 'Ofícios',
                        permissions: [{ id: 'parent_criar_oficio', label: 'Módulo: Ofícios' }],
                        color: 'blue'
                      },
                      {
                        title: 'Compras',
                        permissions: [
                          { id: 'parent_compras', label: 'Módulo: Compras' },
                          { id: 'parent_compras_pedidos', label: 'Gestão de Pedidos' },
                          { id: 'parent_compras_itens', label: 'Catálogo e Inventário' },
                          { id: 'parent_compras_dados', label: 'Importar Planilha' }
                        ],
                        color: 'emerald'
                      },
                      {
                        title: 'Diárias e Custeio',
                        permissions: [
                          { id: 'parent_diarias', label: 'Módulo: Diárias' },
                          { id: 'parent_diarias_editor', label: 'Nova Solicitação' },
                          { id: 'parent_diarias_historico', label: 'Histórico' },
                          { id: 'parent_diarias_novo_evento', label: 'Novo Evento' },
                          { id: 'parent_diarias_lancamentos', label: 'Lançamentos' },
                          { id: 'parent_diarias_gestores', label: 'Gestores' },
                          { id: 'parent_diarias_viajar', label: 'Viajar' },
                          { id: 'parent_diarias_adiantamento', label: 'Solicitar Adiantamento' }
                        ],
                        color: 'amber'
                      },
                      {
                        title: 'Gestão de Abastecimento',
                        permissions: [
                          { id: 'parent_abastecimento', label: 'Módulo: Abastecimento' },
                          { id: 'parent_abastecimento_novo', label: 'Novo Abastecimento' },
                          { id: 'parent_abastecimento_gestao', label: 'Gestão / Histórico' },
                          { id: 'parent_abastecimento_dashboard', label: 'Dashboard' }
                        ],
                        color: 'cyan'
                      },
                      {
                        title: 'Licitação',
                        permissions: [
                          { id: 'parent_licitacao', label: 'Módulo: Licitação' },
                          { id: 'parent_licitacao_processos', label: 'Processos' },
                          { id: 'parent_licitacao_triagem', label: 'Triagem' }
                        ],
                        color: 'purple'
                      },
                      {
                        title: 'Administrativo',
                        permissions: [{ id: 'parent_admin', label: 'Painel Administrativo' }],
                        color: 'indigo'
                      },
                      {
                        title: 'Veículos & Frotas',
                        permissions: [
                          { id: 'parent_agendamento_veiculo', label: 'Módulo: Agendamento de Veículos' },
                          { id: 'parent_agendamento_veiculo_agendar', label: 'Agendar Veículo' },
                          { id: 'parent_agendamento_veiculo_meus', label: 'Meus Agendamentos' },
                          { id: 'parent_agendamento_veiculo_aprovacoes', label: 'Aprovações' },
                          { id: 'parent_agendamento_veiculo_dashboard', label: 'Dashboard Analítico' },
                          { id: 'parent_frotas', label: 'Módulo: Frotas' },
                          { id: 'parent_frotas_dashboard', label: 'Dashboard Frotas' },
                          { id: 'parent_frotas_leve', label: 'Frota Leve' },
                          { id: 'parent_frotas_pesado', label: 'Frota Pesada / Máquinas' },
                          { id: 'parent_frotas_acessorio', label: 'Acessórios & Equipamentos' }
                        ],
                        color: 'rose'
                      },
                      {
                        title: 'Módulos Operacionais',
                        permissions: [
                          { id: 'parent_agricultura', label: 'Agricultura' },
                          { id: 'parent_obras', label: 'Obras' },
                          { id: 'parent_calendario', label: 'Calendário' },
                          { id: 'parent_rh', label: 'Módulo: RH' },
                          { id: 'parent_rh_horas_extras', label: 'RH: Horas Extras' },
                          { id: 'parent_rh_historico', label: 'RH: Histórico' },
                          { id: 'parent_marketing', label: 'Marketing Digital' },
                          { id: 'parent_projetos', label: 'Gestão de Projetos' }
                        ],
                        color: 'teal'
                      },
                      {
                        title: 'Gestão de Tarefas',
                        permissions: [{ id: 'parent_tarefas', label: 'Módulo: Tarefas' }],
                        color: 'pink'
                      },
                      {
                        title: 'Regulação de Consultas',
                        permissions: [
                          { id: 'parent_consultas', label: 'Módulo: Consultas' },
                          { id: 'parent_consultas_novo_agendamento', label: 'Novo Agendamento' },
                          { id: 'parent_consultas_acompanhar', label: 'Acompanhar' },
                          { id: 'parent_consultas_dados', label: 'Área de Dados' },
                          { id: 'parent_consultas_pacientes', label: 'Pacientes' },
                          { id: 'parent_consultas_gestor', label: 'Gestor' }
                        ],
                        color: 'sky'
                      },
                      {
                        title: 'Farmácia Popular',
                        permissions: [
                          { id: 'parent_farmacia', label: 'Módulo: Farmácia Popular' },
                          { id: 'parent_farmacia_consultar', label: 'Consultar' },
                          { id: 'parent_farmacia_retirar', label: 'Retirar' },
                          { id: 'parent_farmacia_estoque', label: 'Estoque' },
                          { id: 'parent_farmacia_dashboard', label: 'Dashboard' },
                          { id: 'parent_farmacia_pacientes', label: 'Pacientes' },
                          { id: 'parent_farmacia_gestor', label: 'Gestor' }
                        ],
                        color: 'violet'
                      },
                      {
                        title: 'Upload Rápido',
                        permissions: [
                          { id: 'parent_upload', label: 'Módulo: Upload Rápido' }
                        ],
                        color: 'sky'
                      }
                    ].map((category) => (
                      <div key={category.title} className="bg-slate-50/50 rounded-2xl p-5 border border-slate-100/60">
                        <h4 className={`text-xs font-black uppercase tracking-wider mb-4 text-${category.color}-600 flex items-center gap-2`}>
                          <span className={`w-2 h-2 rounded-full bg-${category.color}-500`}></span>
                          {category.title}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {category.permissions.map((perm) => {
                            const isChecked = formData.permissions?.includes(perm.id as AppPermission);
                            const isPurchaseManagement = perm.id === 'parent_compras_pedidos';
                            const isAllowedForRole = isAdmin && (!isPurchaseManagement || (formData.role === 'admin' || formData.role === 'compras'));

                            return (
                              <label
                                key={perm.id}
                                className={`relative group flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 select-none
                                            ${!isAllowedForRole ? 'opacity-40 cursor-not-allowed bg-slate-100 grayscale' : 'cursor-pointer'}
                                            ${isChecked
                                    ? `bg-white border-${category.color}-200 shadow-md shadow-${category.color}-500/5 ring-1 ring-${category.color}-500/20`
                                    : 'bg-white border-slate-200 hover:border-slate-300 hover:shadow-sm'}
                                          `}
                              >
                                <div className={`relative flex items-center justify-center w-5 h-5 rounded-md border transition-colors
                                      ${isChecked ? `bg-${category.color}-500 border-${category.color}-500 text-white` : 'bg-slate-50 border-slate-300 group-hover:border-slate-400'}`}>
                                  {isChecked && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    disabled={!isAllowedForRole}
                                    onChange={() => toggleAppPermission(perm.id as AppPermission)}
                                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer disabled:cursor-not-allowed"
                                  />
                                </div>
                                <div className="flex flex-col">
                                  <span className={`text-xs font-bold transition-colors ${isChecked ? 'text-slate-800' : 'text-slate-600'}`}>
                                    {perm.label}
                                  </span>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
              </div>
            )}

          {/* ABA: ASSINATURAS (EM FORMATO DE SELECT) */}
          {activeUserTab === 'assinaturas' && (
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 md:p-10 space-y-8 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
                <div>
                  <h3 className="text-lg font-black text-slate-900 flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                      <PenTool className="w-5 h-5" />
                    </div>
                    Assinaturas Permitidas
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Selecione no formato de Select quais assinaturas este usuário tem permissão para assinar documentos e ofícios.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="px-3 py-1.5 rounded-xl text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center gap-2 shadow-sm">
                    <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                    {(formData.allowedSignatureIds || []).length} de {availableSignatures.length} autorizada(s)
                  </span>
                </div>
              </div>

              {/* Seletor em Formato de Select (Multi-Select Moderno e Dinâmico) */}
              <div className="space-y-4 max-w-3xl">
                <label className={labelClass}>
                  Assinaturas Permitidas (Formato de Select)
                </label>

                {/* Container com ref para clique fora fechar dropdown */}
                <div className="relative" ref={signatureSelectRef}>
                  {/* Gatilho do Select */}
                  <button
                    type="button"
                    disabled={!isAdmin}
                    onClick={() => setIsSignatureSelectOpen(!isSignatureSelectOpen)}
                    className={`w-full min-h-[54px] p-3.5 rounded-2xl border text-left transition-all duration-200 flex items-center justify-between gap-3 cursor-pointer ${
                      !isAdmin ? 'opacity-60 cursor-not-allowed bg-slate-100' : 'bg-slate-50 hover:bg-white focus:bg-white'
                    } ${
                      isSignatureSelectOpen 
                        ? 'border-indigo-500 ring-4 ring-indigo-500/10 shadow-md bg-white' 
                        : 'border-slate-200 hover:border-slate-300 shadow-sm'
                    }`}
                  >
                    <div className="flex items-center gap-3 flex-wrap flex-1 min-w-0">
                      <div className="p-2 rounded-xl bg-indigo-100/70 text-indigo-600 shrink-0">
                        <PenTool className="w-4 h-4" />
                      </div>

                      {(formData.allowedSignatureIds || []).length === 0 ? (
                        <span className="text-sm text-slate-400 font-medium">
                          Selecione as assinaturas autorizadas para este usuário...
                        </span>
                      ) : (
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span className="px-2.5 py-1 rounded-lg text-xs font-black bg-indigo-600 text-white shadow-sm shrink-0">
                            {(formData.allowedSignatureIds || []).length} {(formData.allowedSignatureIds || []).length === 1 ? 'assinatura selecionada' : 'assinaturas selecionadas'}
                          </span>
                          <div className="flex items-center gap-1.5 flex-wrap overflow-hidden text-xs text-slate-600 font-medium">
                            {availableSignatures
                              .filter(sig => formData.allowedSignatureIds?.includes(sig.id))
                              .slice(0, 3)
                              .map(sig => (
                                <span key={sig.id} className="px-2 py-0.5 rounded-md bg-slate-200/80 text-slate-700 text-[11px] font-bold truncate max-w-[140px]">
                                  {sig.name}
                                </span>
                              ))}
                            {(formData.allowedSignatureIds || []).length > 3 && (
                              <span className="text-[11px] font-bold text-slate-400">
                                +{(formData.allowedSignatureIds || []).length - 3} mais
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 text-slate-400">
                      {isAdmin && (formData.allowedSignatureIds || []).length > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleClearAllSignatures();
                          }}
                          className="p-1 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Limpar seleção"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                      <div className={`transition-transform duration-200 ${isSignatureSelectOpen ? 'rotate-180 text-indigo-600' : ''}`}>
                        <ChevronDown className="w-5 h-5" />
                      </div>
                    </div>
                  </button>

                  {/* Dropdown Aberto */}
                  {isSignatureSelectOpen && (
                    <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-200 p-3 z-50 animate-slide-up space-y-3">
                      {/* Campo de Busca Rápida */}
                      <div className="relative">
                        <input
                          type="text"
                          value={signatureSearch}
                          onChange={(e) => setSignatureSearch(e.target.value)}
                          placeholder="Buscar por nome, cargo ou setor..."
                          className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-xs focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                          autoFocus
                        />
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        {signatureSearch && (
                          <button
                            type="button"
                            onClick={() => setSignatureSearch('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Ações Rápidas */}
                      {isAdmin && (
                        <div className="flex items-center justify-between px-1 text-[11px] font-bold text-slate-500 border-b border-slate-100 pb-2">
                          <span>Opções de Assinatura</span>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={handleSelectAllSignatures}
                              className="text-indigo-600 hover:text-indigo-800 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <CheckSquare className="w-3.5 h-3.5" />
                              Selecionar Todas
                            </button>
                            <button
                              type="button"
                              onClick={handleClearAllSignatures}
                              className="text-slate-500 hover:text-rose-600 transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Square className="w-3.5 h-3.5" />
                              Limpar Seleção
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Lista de Opções */}
                      <div className="max-h-64 overflow-y-auto custom-scrollbar space-y-1">
                        {availableSignatures
                          .filter(sig => {
                            if (!signatureSearch.trim()) return true;
                            const term = signatureSearch.toLowerCase();
                            return (
                              sig.name.toLowerCase().includes(term) ||
                              (sig.role && sig.role.toLowerCase().includes(term)) ||
                              (sig.sector && sig.sector.toLowerCase().includes(term))
                            );
                          })
                          .map(sig => {
                            const isChecked = formData.allowedSignatureIds?.includes(sig.id);
                            return (
                              <div
                                key={sig.id}
                                onClick={() => toggleSignaturePermission(sig.id)}
                                className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none ${
                                  isChecked
                                    ? 'bg-indigo-50/80 border-indigo-200 text-indigo-900 shadow-sm'
                                    : 'bg-white border-transparent hover:bg-slate-50 text-slate-700'
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors shrink-0 ${
                                    isChecked 
                                      ? 'bg-indigo-600 border-indigo-600 text-white' 
                                      : 'bg-white border-slate-300'
                                  }`}>
                                    {isChecked && <Check className="w-3.5 h-3.5" strokeWidth={3} />}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-bold text-xs truncate">{sig.name}</div>
                                    <div className="text-[10px] text-slate-500 truncate flex items-center gap-1.5 mt-0.5">
                                      <span className="font-medium">{sig.role}</span>
                                      {sig.sector && (
                                        <>
                                          <span className="text-slate-300">•</span>
                                          <span>{sig.sector}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {isChecked && (
                                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 bg-indigo-100/60 px-2 py-0.5 rounded-md shrink-0 ml-2">
                                    Autorizada
                                  </span>
                                )}
                              </div>
                            );
                          })}

                        {availableSignatures.filter(sig => {
                          if (!signatureSearch.trim()) return true;
                          const term = signatureSearch.toLowerCase();
                          return (
                            sig.name.toLowerCase().includes(term) ||
                            (sig.role && sig.role.toLowerCase().includes(term)) ||
                            (sig.sector && sig.sector.toLowerCase().includes(term))
                          );
                        }).length === 0 && (
                          <div className="p-6 text-center text-slate-400 text-xs italic">
                            Nenhuma assinatura encontrada com esse termo.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Seção Visual: Cards das Assinaturas Autorizadas */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className={labelClass}>
                    Assinaturas Atualmente Autorizadas para este Usuário
                  </label>
                  <span className="text-xs font-bold text-slate-400">
                    {(formData.allowedSignatureIds || []).length} selecionada(s)
                  </span>
                </div>

                {(formData.allowedSignatureIds || []).length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {availableSignatures
                      .filter(sig => formData.allowedSignatureIds?.includes(sig.id))
                      .map(sig => (
                        <div
                          key={sig.id}
                          className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-sm hover:shadow-md transition-all flex items-start justify-between gap-3 group relative overflow-hidden"
                        >
                          <div className="absolute top-0 left-0 bottom-0 w-1 bg-indigo-500 rounded-l-full"></div>
                          <div className="flex items-start gap-3 pl-1 min-w-0">
                            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs shrink-0 shadow-inner">
                              <PenTool className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-bold text-xs text-slate-800 truncate" title={sig.name}>
                                {sig.name}
                              </h4>
                              <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5" title={sig.role}>
                                {sig.role}
                              </p>
                              {sig.sector && (
                                <span className="inline-block text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md font-bold mt-1.5 truncate max-w-full">
                                  {sig.sector}
                                </span>
                              )}
                            </div>
                          </div>

                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => toggleSignaturePermission(sig.id)}
                              className="p-1.5 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0 cursor-pointer"
                              title="Remover autorização"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="p-8 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 text-center space-y-2">
                    <div className="w-10 h-10 mx-auto rounded-full bg-slate-200/80 text-slate-400 flex items-center justify-center">
                      <PenTool className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-bold text-slate-600">
                      Nenhuma assinatura autorizada para este usuário
                    </p>
                    <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
                      Utilize o seletor acima para conceder permissões de assinatura digital neste perfil.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Rodapé da Página com Ações */}
          <div className="bg-white rounded-2xl border border-slate-200/80 p-5 flex items-center justify-between shadow-sm">
            <button
              type="button"
              onClick={handleBackToList}
              className="px-6 py-3 font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer flex items-center gap-2 text-sm"
            >
              <ArrowLeft className="w-4 h-4" /> Voltar para Lista
            </button>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleBackToList}
                className="px-6 py-3 font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer text-sm"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="px-8 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-indigo-600 shadow-xl flex items-center gap-2 transition-all cursor-pointer text-sm"
              >
                <Save className="w-5 h-5" /> {isAdmin ? 'Salvar Usuário' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

        {/* MODAL DE CONFIRMAÇÃO PERSONALIZADO */}
        {
          confirmModal.isOpen && createPortal(
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
              <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-slide-up border border-white/20">
                <div className="p-8 text-center">
                  <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl ${confirmModal.type === 'danger' ? 'bg-rose-50 text-rose-600 shadow-rose-500/10' :
                    confirmModal.type === 'warning' ? 'bg-amber-50 text-amber-600 shadow-amber-500/10' :
                      'bg-indigo-50 text-indigo-600 shadow-indigo-500/10'
                    }`}>
                    {confirmModal.type === 'danger' ? <Trash className="w-10 h-10" /> :
                      confirmModal.type === 'warning' ? <AlertTriangle className="w-10 h-10" /> :
                        <Info className="w-10 h-10" />}
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight mb-2 uppercase">{confirmModal.title}</h3>
                  <p className="text-slate-500 text-sm font-medium leading-relaxed px-4">{confirmModal.message}</p>
                </div>
                <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col gap-3">
                  <button
                    onClick={confirmModal.onConfirm}
                    // Fix: Added missing quotes around the default branch of the ternary operator for button styles
                    className={`w-full py-4 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl transition-all active:scale-[0.98] ${confirmModal.type === 'danger' ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20' :
                      confirmModal.type === 'warning' ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20' :
                        'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
                      }`}
                  >
                    Confirmar Ação
                  </button>
                  <button
                    onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                    className="w-full py-4 bg-white text-slate-400 font-black text-xs uppercase tracking-[0.2em] rounded-2xl border border-slate-200 hover:bg-slate-50 hover:text-slate-600 transition-all"
                  >
                    Voltar / Cancelar
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        }

        {/* MODAL CONECTAR GOOGLE AGENDA (SEM WINDOW.PROMPT) */}
        {
          isGoogleConnectModalOpen && createPortal(
            <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-fade-in">
              <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden border border-white/20 p-6 md:p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-indigo-50 border border-indigo-100 text-indigo-600 rounded-2xl">
                      <Calendar className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-800 tracking-tight">Conectar Google Agenda</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Autorização OAuth 2.0</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsGoogleConnectModalOpen(false)}
                    className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">
                      E-mail da Conta Google
                    </label>
                    <input
                      type="email"
                      value={connectGoogleEmail}
                      onChange={(e) => setConnectGoogleEmail(e.target.value)}
                      className="w-full px-4 py-3 rounded-2xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 font-medium text-sm text-slate-800"
                      placeholder="seu.email@gmail.com"
                    />
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2 text-xs text-slate-500">
                    <div className="flex items-center gap-2 font-extrabold text-slate-700">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" />
                      Permissões Solicitadas:
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      • Leitura e escrita de eventos no Google Calendar (<span className="font-mono text-slate-600">calendar.events</span>).<br />
                      • Eventos do sistema serão sincronizados com seu celular.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsGoogleConnectModalOpen(false)}
                    className="flex-1 py-3 text-slate-500 hover:text-slate-700 font-extrabold text-xs uppercase tracking-wider rounded-xl hover:bg-slate-100 transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={googleLoading || !connectGoogleEmail.trim()}
                    onClick={async () => {
                      setGoogleLoading(true);
                      const result = await googleCalendarService.connectAccount(formData as User, connectGoogleEmail);
                      setGoogleLoading(false);
                      setIsGoogleConnectModalOpen(false);

                      if (result.success) {
                        const now = new Date().toISOString();
                        setFormData(prev => ({
                          ...prev,
                          google_connected: true,
                          google_email: result.googleEmail,
                          google_connected_at: now,
                          last_google_sync_at: now
                        }));
                        showToast('Google Agenda conectado com sucesso!');
                      } else if (result.error) {
                        showToast(result.error, 'error');
                      }
                    }}
                    className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {googleLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
                    Autorizar e Conectar
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        }

        {/* TOAST NOTIFICATION */}
        {
          toast.show && createPortal(
            <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[300] px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-3 animate-slide-up ${toast.type === 'success' ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-rose-600 border-rose-500 text-white'
              }`}>
              {toast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
              <span className="font-bold text-sm">{toast.message}</span>
            </div>,
            document.body
          )
        }
    </div>
  );
};
