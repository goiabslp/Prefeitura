
import React, { useState, useEffect } from 'react';
import { User, Lock, ArrowRight, FileText, ShieldCheck, CheckCircle2, Eye, EyeOff, ShoppingCart, Truck, Users, Leaf, HardHat, ScanFace, Fingerprint } from 'lucide-react';
import { UIConfig } from '../types';
import { getCachedImage, IMAGE_KEYS } from '../services/cacheService';
import { supabase } from '../services/supabaseClient';
import { auditLogService } from '../services/auditLogService';
import { authenticateWithBiometrics, setBiometricsEnabled } from '../services/biometricService';

interface LoginScreenProps {
  onLogin: (username: string, password: string) => Promise<{ error?: any; data?: any }>;
  uiConfig: UIConfig;
  onLoginSuccess?: () => void;
  onNavigateView?: (view: string) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, uiConfig, onLoginSuccess, onNavigateView }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isUpdatingSystem, setIsUpdatingSystem] = useState(false);
  const [currentModuleIdx, setCurrentModuleIdx] = useState(0);

  const systemModules = [
    { name: 'Licitação e Contratos', desc: 'Gestão transparente de processos e aditivos.', icon: ShoppingCart, color: 'text-indigo-600', bg: 'bg-indigo-100', border: 'border-indigo-200' },
    { name: 'Recursos Humanos', desc: 'Controle de folha, diárias, e horas extras.', icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-100', border: 'border-emerald-200' },
    { name: 'Gestão de Frotas', desc: 'Controle rigoroso de veículos e abastecimentos.', icon: Truck, color: 'text-amber-600', bg: 'bg-amber-100', border: 'border-amber-200' },
    { name: 'Obras Públicas', desc: 'Acompanhamento de medições e execuções.', icon: HardHat, color: 'text-orange-600', bg: 'bg-orange-100', border: 'border-orange-200' },
    { name: 'Agricultura e Serviços', desc: 'Agendamento e controle de patrulha rural.', icon: Leaf, color: 'text-green-600', bg: 'bg-green-100', border: 'border-green-200' },
  ];

  useEffect(() => {
    if (isUpdatingSystem) {
      const interval = setInterval(() => {
        setCurrentModuleIdx(prev => (prev + 1) % systemModules.length);
      }, 1000); // Mudar a cada 1s para o carrossel ser mais dinâmico
      return () => clearInterval(interval);
    }
  }, [isUpdatingSystem]);

  const [hasSavedBiometrics, setHasSavedBiometrics] = useState<boolean>(false);

  // Carrega credenciais salvas ao montar o componente
  useEffect(() => {
    setIsVisible(true);
    const savedUser = localStorage.getItem('remember_user');
    const savedPass = localStorage.getItem('remember_pass');

    if (savedUser && savedPass) {
      setUsername(savedUser);
      setPassword(savedPass);
      setRememberMe(true);
      setHasSavedBiometrics(true);
    }
  }, []);

  const handleBiometricLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const creds = await authenticateWithBiometrics();
      if (creds && creds.user && creds.pass) {
        setUsername(creds.user);
        setPassword(creds.pass);
        const emailToUse = creds.user.includes('@') ? creds.user : `${creds.user}@projeto.local`;
        const { error } = await onLogin(emailToUse, creds.pass);
        if (!error) {
          setBiometricsEnabled(true, creds.user, creds.pass);
          setIsUpdatingSystem(true);
          onLoginSuccess?.();
        } else {
          setError('Falha na verificação de credenciais salvas.');
        }
      } else {
        setError('Nenhuma credencial biométrica encontrada.');
      }
    } catch (err: any) {
      console.error(err);
      setError('Autenticação por Face ID / Biometria cancelada.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Por favor, preencha todos os campos.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const emailToUse = username.includes('@') ? username : `${username}@projeto.local`;
      const { error } = await onLogin(emailToUse, password);

      if (!error) {
        if (rememberMe) {
          localStorage.setItem('remember_user', username);
          localStorage.setItem('remember_pass', password);
        } else {
          localStorage.removeItem('remember_user');
          localStorage.removeItem('remember_pass');
        }

        // Registrar log de login
        auditLogService.logAction({
          action_type: 'login',
          module: 'auth',
          description: `Login efetuado com sucesso pelo usuário ${username.toUpperCase()}`,
          details: { email: emailToUse }
        });

        // Show modern loading screen upon successful login
        setIsUpdatingSystem(true);
        
        try {
          const WINDOW_KEY = 'sys_refresh_window_v1';
          const FORCED_WINDOW_KEY = 'sys_forced_refresh_target_v1';
          const now = Date.now();
          const d = new Date(now);
          const hour = d.getHours();
          let logicalDate = d;
          let block = "18";
          if (hour >= 7 && hour < 12) block = "07";
          else if (hour >= 12 && hour < 18) block = "12";
          else if (hour < 7) logicalDate = new Date(now - 7 * 60 * 60 * 1000);
          
          const currentWindow = `${logicalDate.getFullYear()}-${logicalDate.getMonth()}-${logicalDate.getDate()}-${block}`;
          
          if ('caches' in window) {
             const keys = await caches.keys();
             await Promise.all(keys.map(k => caches.delete(k)));
          }
          localStorage.setItem(WINDOW_KEY, currentWindow);
          
          const { data: orgData } = await supabase.from('organization_settings').select('system_update_target').eq('id', 'global_config').single();
          if (orgData?.system_update_target) {
              localStorage.setItem(FORCED_WINDOW_KEY, orgData.system_update_target.toString());
          }
        } catch(e) {
          console.error("Silent cache clear failed", e);
        }

        // Delay to show the beautiful loading modal
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        if (onLoginSuccess) {
            onLoginSuccess();
        }
        return;
      } else {
        setError('Credenciais inválidas. Tente novamente.');
        setLoading(false);
      }
    } catch (err) {
      setError('Erro ao conectar ao servidor.');
      setLoading(false);
    }
  };

  const logoUrl = uiConfig?.loginLogoUrl;
  const logoHeight = uiConfig?.loginLogoHeight || 80;

  return (
    <div className="h-screen w-screen font-sans flex items-center justify-center p-3 sm:p-6 relative overflow-hidden bg-[#07090e]">

      {/* Background Dinâmico com Auroras Animadas */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[55%] h-[55%] bg-indigo-600/10 rounded-full blur-[140px] animate-[pulse_12s_infinite_alternate]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-purple-600/10 rounded-full blur-[130px] animate-[pulse_15s_infinite_alternate_2s]"></div>
        <div className="absolute top-[30%] left-[20%] w-[30%] h-[30%] bg-blue-500/5 rounded-full blur-[100px] animate-[pulse_10s_infinite_alternate_1s]"></div>

        {/* Subtle dot matrix pattern */}
        <div className="absolute inset-0 opacity-[0.02] mix-blend-overlay" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
      </div>

      <div className={`w-full max-w-[450px] bg-[#10141d]/55 backdrop-blur-3xl rounded-[2.5rem] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)] border border-white/10 overflow-hidden transition-all duration-1000 transform ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'} relative z-10`}>

        {/* Form de Login */}
        <div className="p-6 sm:p-10 flex flex-col justify-center bg-white/[0.01] max-h-[90dvh] overflow-y-auto scrollbar-slim">
          <div className="mb-6 xl:mb-8 text-center flex flex-col items-center">
            {logoUrl ? (
              <div className="mb-4 flex justify-center max-h-[75px] xl:max-h-[90px] overflow-hidden">
                <img
                  src={getCachedImage(logoUrl, IMAGE_KEYS.loginLogoUrl) || logoUrl}
                  alt="Logo"
                  style={{ height: 'auto', maxHeight: '100%', maxWidth: '220px' }}
                  className="object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.4)]"
                />
              </div>
            ) : (
              <h1 className="text-2xl xl:text-3xl font-bold text-white mb-2">Bem-vindo</h1>
            )}
            <p className="text-slate-400 text-xs xl:text-sm font-medium">Faça login para gerenciar seus documentos.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 xl:space-y-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Usuário</label>
              <div className="relative group">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toUpperCase())}
                  className="w-full pl-11 pr-4 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-white placeholder-slate-600 focus:bg-white/[0.06] focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all duration-300 text-sm"
                  placeholder="SEU USUÁRIO DE ACESSO"
                />
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Senha</label>
                <button type="button" className="text-[9px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-wider">Esqueceu a senha?</button>
              </div>
              <div className="relative group">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-11 py-3 bg-white/[0.03] border border-white/10 rounded-xl text-white placeholder-slate-600 focus:bg-white/[0.06] focus:border-indigo-500/50 focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all duration-300 text-sm"
                  placeholder="••••••••"
                />
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-indigo-400 transition-colors focus:outline-none"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between px-1">
              <label className="flex items-center gap-2.5 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <div className={`w-8 h-4 rounded-full transition-colors duration-300 ${rememberMe ? 'bg-indigo-500' : 'bg-white/10'}`}></div>
                  <div className={`absolute left-0.5 top-0.5 w-3 h-3 bg-white rounded-full transition-transform duration-300 ${rememberMe ? 'translate-x-4' : 'translate-x-0'}`}></div>
                </div>
                <span className="text-[10px] font-bold text-slate-400 group-hover:text-slate-200 transition-colors uppercase tracking-widest">Manter conectado</span>
              </label>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] font-bold text-center animate-shake flex items-center justify-center gap-2">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                {error}
              </div>
            )}

            {hasSavedBiometrics && (
              <button
                type="button"
                onClick={handleBiometricLogin}
                disabled={loading}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-indigo-500/20 hover:from-emerald-500/30 hover:to-indigo-500/30 border border-emerald-500/40 rounded-xl text-white text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2.5 shadow-lg active:scale-95 group"
              >
                <ScanFace className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
                <span>Entrar com Face ID / Touch ID</span>
              </button>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full relative group overflow-hidden rounded-xl shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 transition-all duration-300 active:scale-[0.98]"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-600 transition-all duration-500 group-hover:scale-105"></div>
              <div className="relative py-3 flex items-center justify-center gap-2 text-white text-sm font-bold tracking-wider uppercase">
                {loading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    Entrar no Sistema
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </div>
            </button>
          </form>

          <div className="mt-8 text-center space-y-2">
            <p className="text-[9px] text-slate-600 font-bold uppercase tracking-[0.3em]">Ambiente Seguro Certificado</p>
            <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] text-indigo-400 font-medium pt-1">
              <a
                href="/PoliticaPrivacidade"
                onClick={(e) => {
                  e.preventDefault();
                  window.history.pushState({}, '', '/PoliticaPrivacidade');
                  onNavigateView?.('politica-privacidade');
                }}
                className="hover:text-white transition-colors underline cursor-pointer"
              >
                Política de Privacidade
              </a>
              <span className="text-slate-700">•</span>
              <a
                href="/PoliticaPrivacidadeApp"
                onClick={(e) => {
                  e.preventDefault();
                  window.history.pushState({}, '', '/PoliticaPrivacidadeApp');
                  onNavigateView?.('politica-privacidade-app');
                }}
                className="hover:text-white transition-colors underline cursor-pointer"
              >
                Política de Privacidade do Aplicativo
              </a>
            </div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.3s ease-in-out;
        }
        
        /* Custom slim scrollbar for internal scroll */
        .scrollbar-slim::-webkit-scrollbar {
          width: 4px;
        }
        .scrollbar-slim::-webkit-scrollbar-track {
          background: transparent;
        }
        .scrollbar-slim::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.08);
          border-radius: 9999px;
        }
        .scrollbar-slim::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.15);
        }
      `}} />

      {isUpdatingSystem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#0a0c10]/80 backdrop-blur-md animate-fade-in" style={{ animation: 'fadeIn 0.3s forwards' }}>
           <div className="w-full max-w-2xl bg-white rounded-[2rem] shadow-[0_20px_80px_rgba(0,0,0,0.6)] border border-slate-200 p-12 text-center relative overflow-hidden flex flex-col items-center">
             
             {/* Decorators */}
             <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-blue-500"></div>
             <div className="absolute -top-32 -right-32 w-64 h-64 bg-indigo-50 rounded-full blur-3xl"></div>
             <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-emerald-50 rounded-full blur-3xl"></div>

             {/* Header */}
             <div className="relative z-10 flex flex-col items-center mb-10">
                <div className="w-20 h-20 mb-6 relative flex items-center justify-center">
                    <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
                    <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center animate-pulse">
                      <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                    </div>
                </div>
                <h3 className="text-3xl font-black text-slate-800 mb-3 tracking-tight">Preparando Ambiente</h3>
                <p className="text-slate-500 font-medium text-lg">Carregando e otimizando módulos do sistema...</p>
             </div>

             {/* Carousel */}
             <div className="w-full relative z-10 h-[120px] flex items-center justify-center">
               {systemModules.map((mod, idx) => {
                 const isActive = idx === currentModuleIdx;
                 return (
                   <div 
                     key={idx}
                     className={`absolute transition-all duration-700 ease-in-out w-full max-w-md bg-white rounded-2xl p-6 border shadow-sm flex items-center gap-5
                        ${isActive ? 'opacity-100 translate-y-0 scale-100 z-20 ' + mod.border : 'opacity-0 translate-y-8 scale-90 z-0 border-slate-100'}`}
                   >
                      <div className={`w-14 h-14 rounded-2xl flex-shrink-0 flex items-center justify-center ${mod.bg} ${mod.color}`}>
                        <mod.icon className="w-7 h-7" />
                      </div>
                      <div className="text-left flex-1">
                        <h4 className="text-lg font-bold text-slate-800 mb-1 leading-tight">{mod.name}</h4>
                        <p className="text-sm text-slate-500 font-medium leading-tight">{mod.desc}</p>
                      </div>
                   </div>
                 );
               })}
             </div>

             {/* Progress indicator */}
             <div className="mt-8 flex gap-2 z-10">
                {systemModules.map((_, idx) => (
                  <div key={idx} className={`h-1.5 rounded-full transition-all duration-500 ${idx === currentModuleIdx ? 'w-8 bg-indigo-600' : 'w-2 bg-slate-200'}`}></div>
                ))}
             </div>
             
           </div>
        </div>
      )}
    </div>
  );
};
