
import React, { useState, useEffect } from 'react';
import { User, Lock, ArrowRight, FileText, ShieldCheck, CheckCircle2, Eye, EyeOff, ShoppingCart, Truck, Users, Leaf, HardHat } from 'lucide-react';
import { UIConfig } from '../types';
import { getCachedImage, IMAGE_KEYS } from '../services/cacheService';
import { supabase } from '../services/supabaseClient';

interface LoginScreenProps {
  onLogin: (username: string, password: string) => Promise<{ error?: any; data?: any }>;
  uiConfig: UIConfig;
  onLoginSuccess?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, uiConfig, onLoginSuccess }) => {
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

  // Carrega credenciais salvas ao montar o componente
  useEffect(() => {
    setIsVisible(true);
    const savedUser = localStorage.getItem('remember_user');
    const savedPass = localStorage.getItem('remember_pass');

    if (savedUser && savedPass) {
      setUsername(savedUser);
      setPassword(savedPass);
      setRememberMe(true);
    }
  }, []);

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
    <div className="min-h-screen font-sans flex items-center justify-center p-4 relative overflow-hidden bg-[#0a0c10]">

      {/* Background Dinâmico com Esferas Animadas */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[10%] right-[-5%] w-[35%] h-[35%] bg-purple-600/15 rounded-full blur-[100px] animate-bounce" style={{ animationDuration: '8s' }}></div>
        <div className="absolute top-[40%] left-[20%] w-[15%] h-[15%] bg-blue-500/10 rounded-full blur-[80px] animate-pulse"></div>

        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '32px 32px' }}></div>
      </div>

      <div className={`w-full max-w-5xl grid lg:grid-cols-2 bg-[#161b22]/40 backdrop-blur-2xl rounded-[2.5rem] shadow-[0_0_50px_rgba(0,0,0,0.5)] border border-white/5 overflow-hidden transition-all duration-1000 transform ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-12 opacity-0'} relative z-10`}>

        {/* Lado Esquerdo - Branding & Info */}
        <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-indigo-600/10 to-transparent relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-16">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
                <FileText className="w-6 h-6 text-white" />
              </div>
            </div>

            <div className="space-y-2 mb-10">
              <h2 className="text-4xl xl:text-5xl font-black text-white leading-[1.1] tracking-tight">
                Soluções Digitais
              </h2>
              <h2 className="text-3xl xl:text-4xl font-bold text-indigo-400/90 leading-[1.1] tracking-tight">
                para a Gestão Pública
              </h2>
              <h2 className="text-2xl xl:text-3xl font-semibold text-white/40 leading-[1.1] tracking-tight uppercase">
                Municipal
              </h2>
            </div>

            <div className="space-y-6">
              {[
                { icon: <ShieldCheck className="w-5 h-5" />, text: "Segurança de dados ponta a ponta" },
                { icon: <CheckCircle2 className="w-5 h-5" />, text: "Padronização visual automática" }
              ].map((item, idx) => (
                <div key={idx} className="flex items-center gap-4 text-indigo-100/70 animate-fade-in" style={{ animationDelay: `${idx * 200}ms` }}>
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-indigo-400">
                    {item.icon}
                  </div>
                  <p className="text-sm font-medium">{item.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 mt-auto pt-12 border-t border-white/5">
            <p className="text-xs text-white/30 font-bold uppercase tracking-[0.2em]">Tecnologia Municipal 4.0</p>
          </div>
          <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl"></div>
        </div>

        {/* Lado Direito - Form de Login */}
        <div className="p-8 lg:p-16 flex flex-col justify-center bg-white/[0.02]">
          <div className="mb-10 text-center">

            {logoUrl ? (
              <div className="mb-8 flex justify-center">
                <img
                  src={getCachedImage(logoUrl, IMAGE_KEYS.loginLogoUrl) || logoUrl}
                  alt="Logo"
                  style={{ height: `${logoHeight}px` }}
                  className="object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.3)]"
                />
              </div>
            ) : (
              <h1 className="text-3xl font-bold text-white mb-2">Bem-vindo</h1>
            )}
            <p className="text-slate-400 font-medium">Faça login para gerenciar seus documentos.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Usuário</label>
              <div className="relative group">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toUpperCase())}
                  className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-slate-600 focus:bg-white/[0.08] focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all duration-300"
                  placeholder="Seu usuário de acesso"
                />
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest">Senha</label>
                <button type="button" className="text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-wider">Esqueceu a senha?</button>
              </div>
              <div className="relative group">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-12 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-slate-600 focus:bg-white/[0.08] focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all duration-300"
                  placeholder="••••••••"
                />
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-indigo-400 transition-colors focus:outline-none"
                  tabIndex={-1} // Prevent tabbing to this button before submit
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between px-1">
              <label className="flex items-center gap-3 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <div className={`w-10 h-5 rounded-full transition-colors duration-300 ${rememberMe ? 'bg-indigo-600' : 'bg-white/10'}`}></div>
                  <div className={`absolute left-1 top-1 w-3 h-3 bg-white rounded-full transition-transform duration-300 ${rememberMe ? 'translate-x-5' : 'translate-x-0'}`}></div>
                </div>
                <span className="text-xs font-bold text-slate-400 group-hover:text-slate-200 transition-colors uppercase tracking-widest">Manter conectado</span>
              </label>
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold text-center animate-shake flex items-center justify-center gap-2">
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full relative group overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 transition-all duration-500 group-hover:scale-110"></div>
              <div className="relative py-4 rounded-2xl flex items-center justify-center gap-2 text-white font-bold transition-transform active:scale-95">
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    Entrar no Sistema
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </div>
            </button>
          </form>

          <div className="mt-12 text-center">
            <p className="text-[10px] text-slate-600 font-bold uppercase tracking-[0.3em]">Ambiente Seguro Certificado</p>
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
