
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { User, UserRole, Signature, AppPermission, Job, Sector, Person } from '../types';
import {
  Plus, Search, Edit2, Trash2, ShieldCheck, Users, Save, X, Key,
  PenTool, LayoutGrid, User as UserIcon, CheckCircle2, Gavel, ShoppingCart, Briefcase, Network,
  Eye, EyeOff, RotateCcw, AlertTriangle, Clock, Lock, Copy, Check, Info, Trash, ToggleRight, ArrowLeft, RefreshCw, Megaphone
} from 'lucide-react';

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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  // Estado para Diálogos Customizados (Substituindo Confirm/Alert)
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void, type: 'danger' | 'warning' | 'info' }>({
    isOpen: false, title: '', message: '', onConfirm: () => { }, type: 'info'
  });
  const [toast, setToast] = useState<{ show: boolean, message: string, type: 'success' | 'error' }>({ show: false, message: '', type: 'success' });

  const isAdmin = currentUser.role === 'admin';

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
    permissions: ['parent_criar_oficio']
  });

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

  const handleOpenModal = (user?: User) => {
    setShowPassword(false);
    setCopied(false);
    if (user) {
      setEditingUser(user);
      // Garantindo que agendamento de veículo esteja sempre presente no carregamento
      const basePerms = user.permissions || [];
      const perms = basePerms;

      setFormData({
        ...user,
        allowedSignatureIds: user.allowedSignatureIds || [],
        permissions: perms,
        password: '' // Clear password to avoid validation error on existing users
      });
    } else {
      setEditingUser(null);
      setFormData({
        name: '',
        username: '',
        password: generateStrongPassword(), // Auto-generate for new user
        tempPassword: '',
        tempPasswordExpiresAt: undefined,
        role: 'collaborator',
        sector: '',
        jobTitle: '',
        allowedSignatureIds: [],
        email: '',
        whatsapp: '+55',
        permissions: ['parent_criar_oficio']
      });
    }
    setIsModalOpen(true);
  };

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

  const toggleAppPermission = (perm: AppPermission) => {
    if (!isAdmin) return;
    setFormData(prev => {
      const currentPerms = prev.permissions || [];
      if (currentPerms.includes(perm)) {
        return { ...prev, permissions: currentPerms.filter(p => p !== perm) };
      } else {
        return { ...prev, permissions: [...currentPerms, perm] };
      }
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
    setIsModalOpen(false);
  };

  const isEditingSelf = editingUser?.id === currentUser.id;
  const inputClass = "w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed";
  const selectClass = "w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-900 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/5 outline-none transition-all appearance-none cursor-pointer disabled:opacity-60 disabled:bg-slate-100 disabled:cursor-not-allowed";
  const labelClass = "block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5 ml-1";

  const permissionsList: { id: AppPermission, label: string }[] = [
    { id: 'parent_criar_oficio', label: 'Módulo: Ofícios' },
    { id: 'parent_compras', label: 'Módulo: Compras' },
    { id: 'parent_licitacao', label: 'Módulo: Licitação' },
    { id: 'parent_diarias', label: 'Módulo: Diárias e Custeio' },
    { id: 'parent_agendamento_veiculo', label: 'Agendamento de Veículos' },
    { id: 'parent_frotas', label: 'Gestão de Frotas' },
    { id: 'parent_abastecimento', label: 'Gestão de Abastecimento (Geral)' },
    { id: 'parent_abastecimento_novo', label: 'Novo Abastecimento' },
    { id: 'parent_abastecimento_gestao', label: 'Gestão / Histórico Abastecimento' },
    { id: 'parent_abastecimento_dashboard', label: 'Asbastecimento: Dashboard' },
    { id: 'parent_admin', label: 'Administrativo' },
    { id: 'parent_licitacao_triagem', label: 'Licitação: Triagem' },
    { id: 'parent_licitacao_processos', label: 'Licitação: Processos' },
    { id: 'parent_agricultura', label: 'Módulo: Agricultura' },
    { id: 'parent_obras', label: 'Módulo: Obras' },
    { id: 'parent_tarefas', label: 'Módulo: Tarefas' },
    { id: 'parent_calendario', label: 'Módulo: Calendário' }
  ];

  return (
    <div className="flex-1 h-full bg-slate-100 p-6 overflow-auto custom-scrollbar">
      <div className="w-full space-y-6">
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
              onClick={() => handleOpenModal()}
              className="px-5 py-3 bg-slate-900 hover:bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:shadow-indigo-500/30 transition-all flex items-center gap-2"
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
                        user.role === 'licitacao' ? 'bg-gradient-to-br from-blue-500 to-cyan-500 text-white' :
                          user.role === 'compras' ? 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white' :
                            user.role === 'marketing' ? 'bg-gradient-to-br from-fuchsia-500 to-pink-500 text-white' :
                              'bg-gradient-to-br from-slate-200 to-slate-300 text-slate-500'
                      }`}>
                      {user.name.charAt(0)}

                      {/* Status Dot */}
                      <div className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-green-400 border-[3px] border-white rounded-full shadow-sm"></div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-xl font-bold text-slate-800 truncate leading-tight group-hover:text-indigo-900 transition-colors">
                          {user.name}
                        </h3>
                        {isCurrentUser && (
                          <span className="px-2 py-0.5 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-wider rounded-lg shadow-lg shadow-indigo-500/30 whitespace-nowrap">
                            Você
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border backdrop-blur-sm
                          ${user.role === 'admin' ? 'bg-indigo-50/50 text-indigo-700 border-indigo-100' :
                            user.role === 'licitacao' ? 'bg-blue-50/50 text-blue-700 border-blue-100' :
                              user.role === 'compras' ? 'bg-emerald-50/50 text-emerald-700 border-emerald-100' :
                                user.role === 'marketing' ? 'bg-fuchsia-50/50 text-fuchsia-700 border-fuchsia-100' :
                                  'bg-slate-50/50 text-slate-600 border-slate-200'
                          }`}>
                          {user.role === 'admin' && <ShieldCheck className="w-3 h-3" />}
                          {user.role === 'licitacao' && <Gavel className="w-3 h-3" />}
                          {user.role === 'compras' && <ShoppingCart className="w-3 h-3" />}
                          {user.role === 'marketing' && <Megaphone className="w-3 h-3" />}
                          {user.role === 'collaborator' && <UserIcon className="w-3 h-3" />}
                          {user.role}
                        </span>

                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-slate-100/50 text-slate-500 border border-slate-200/50">
                          {user.jobTitle || 'Sem Cargo'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions - Modernized */}
                  <div className="flex items-center gap-3 w-full md:w-auto justify-end border-t md:border-t-0 border-slate-100 pt-4 md:pt-0">
                    <button
                      onClick={() => handleOpenModal(user)}
                      className="group/btn relative px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-500/10 hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-2 font-bold text-xs uppercase tracking-wide"
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

        {/* MODAL DE EDIÇÃO/CADASTRO */}
        {isModalOpen && createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
            <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[95vh] border border-white/20">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="text-xl font-bold text-slate-800">{isAdmin ? (editingUser ? 'Editar Usuário' : 'Novo Usuário') : 'Meu Perfil'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-lg text-slate-500"><X className="w-5 h-5" /></button>
              </div>

              <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar">
                <div className="space-y-4">
                  <label className={labelClass}>Tipo de Perfil</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { id: 'admin', label: 'Admin', desc: 'Acesso total.', icon: <ShieldCheck className="w-5 h-5" />, color: 'indigo' },
                      { id: 'licitacao', label: 'Licitação', desc: 'Módulos sem Admin.', icon: <Gavel className="w-5 h-5" />, color: 'blue' },
                      { id: 'compras', label: 'Compras', desc: 'Módulos + Visão.', icon: <ShoppingCart className="w-5 h-5" />, color: 'emerald' },
                      { id: 'marketing', label: 'Marketing', desc: 'Gestão de mídia.', icon: <Megaphone className="w-5 h-5" />, color: 'fuchsia' },
                      { id: 'collaborator', label: 'Colaborador', desc: 'Operação básica.', icon: <UserIcon className="w-5 h-5" />, color: 'slate' }
                    ].map((role) => {
                      const isSelected = formData.role === role.id;
                      const canEditRole = isAdmin;

                      return (
                        <button
                          key={role.id}
                          type="button"
                          disabled={!canEditRole}
                          onClick={() => handleRoleChange(role.id as UserRole)}
                          className={`relative p-4 rounded-2xl border-2 text-left transition-all duration-300 group ${isSelected
                            ? `bg-${role.color}-50 border-${role.color}-600 ring-4 ring-${role.color}-600/10`
                            : `bg-white border-slate-100 hover:border-slate-300 ${!canEditRole ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`
                            }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className={`p-2 rounded-xl transition-colors ${isSelected ? `bg-${role.color}-600 text-white` : `bg-slate-100 text-slate-400 group-hover:bg-emerald-100`
                              }`}>
                              {role.icon}
                            </div>
                            {isSelected && <CheckCircle2 className={`w-4 h-4 text-${role.color}-600 animate-fade-in`} />}
                          </div>
                          <div className="mt-3">
                            <h4 className={`font-bold text-sm ${isSelected ? `text-${role.color}-900` : 'text-slate-800'}`}>{role.label}</h4>
                            <p className="text-[10px] mt-0.5 leading-tight text-slate-500">{role.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

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

                <div className="border-t border-slate-100 pt-8">
                  <label className={`${labelClass} mb-6 flex items-center gap-2 text-indigo-600 text-sm`}><LayoutGrid className="w-5 h-5" /> Módulos Autorizados</label>

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
                          { id: 'parent_compras', label: 'Gestão de Compras' },
                          { id: 'parent_compras_pedidos', label: 'Gestão de Pedidos' }
                        ],
                        color: 'emerald'
                      },
                      {
                        title: 'Diárias e Custeio',
                        permissions: [{ id: 'parent_diarias', label: 'Módulo: Diárias' }],
                        color: 'amber'
                      },
                      {
                        title: 'Gestão de Abastecimento',
                        permissions: [
                          { id: 'parent_abastecimento', label: 'Módulo Geral' },
                          { id: 'parent_abastecimento_novo', label: 'Novo Abastecimento' },
                          { id: 'parent_abastecimento_gestao', label: 'Gestão / Histórico' },
                          { id: 'parent_abastecimento_dashboard', label: 'Dashboard' }
                        ],
                        color: 'cyan'
                      },
                      {
                        title: 'Licitação',
                        permissions: [
                          { id: 'parent_licitacao', label: 'Módulo Geral' },
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
                          { id: 'parent_agendamento_veiculo', label: 'Agendamento de Veículos' },
                          { id: 'parent_frotas', label: 'Gestão de Frotas' }
                        ],
                        color: 'rose'
                      },
                      {
                        title: 'Módulos Operacionais',
                        permissions: [
                          { id: 'parent_agricultura', label: 'Agricultura' },
                          { id: 'parent_obras', label: 'Obras' },
                          { id: 'parent_calendario', label: 'Calendário' }
                        ],
                        color: 'teal'
                      },
                      {
                        title: 'Gestão de Tarefas',
                        permissions: [{ id: 'parent_tarefas', label: 'Módulo: Tarefas' }],
                        color: 'pink'
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


                <div className="border-t border-slate-100 pt-8">
                  <label className={`${labelClass} mb-4 flex items-center gap-2 text-indigo-600`}><PenTool className="w-4 h-4" /> Assinaturas Permitidas</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {availableSignatures.map(sig => {
                      const isChecked = formData.allowedSignatureIds?.includes(sig.id);
                      return (
                        <label key={sig.id} className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all ${!isAdmin ? 'opacity-40 cursor-not-allowed bg-slate-50' : 'cursor-pointer'} ${isChecked ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200 hover:border-indigo-300'}`}>
                          <input type="checkbox" checked={isChecked} disabled={!isAdmin} onChange={() => toggleSignaturePermission(sig.id)} className="mt-1 w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500" />
                          <div>
                            <div className="font-bold text-xs text-slate-800">{sig.name}</div>
                            <div className="text-[10px] text-slate-500 uppercase font-medium">{sig.role}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
                <button onClick={() => setIsModalOpen(false)} className="px-6 py-3 font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">Cancelar</button>
                <button onClick={handleSave} className="px-8 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-indigo-600 shadow-xl flex items-center gap-2 transition-all"><Save className="w-5 h-5" /> {isAdmin ? 'Salvar Usuário' : 'Salvar Alterações'}</button>
              </div>
            </div>
          </div >,
          document.body
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
      </div >
    </div >
  );
};
