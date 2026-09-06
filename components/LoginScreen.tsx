import React, { useState, useEffect } from 'react';
import { 
  User, 
  Lock, 
  ArrowRight, 
  ShieldCheck, 
  CheckCircle2, 
  Eye, 
  EyeOff, 
  ShoppingCart, 
  Truck, 
  Users, 
  Leaf, 
  HardHat, 
  ScanFace, 
  Zap, 
  KeyRound, 
  X,
  Building2
} from 'lucide-react';
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
  const [showPassword, setShowPassword] = useState(false);
  const [isUpdatingSystem, setIsUpdatingSystem] = useState(false);
  const [currentModuleIdx, setCurrentModuleIdx] = useState(0);
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [hasSavedBiometrics, setHasSavedBiometrics] = useState<boolean>(false);
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const { clientX, clientY } = e;
    const { innerWidth, innerHeight } = window;
    const x = (clientX - innerWidth / 2) / (innerWidth / 2);
    const y = (clientY - innerHeight / 2) / (innerHeight / 2);
    setMouseOffset({ x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) });
  };

  const handleMouseLeave = () => {
    setMouseOffset({ x: 0, y: 0 });
  };

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
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isUpdatingSystem]);

  // Carrega credenciais salvas ao montar o componente
  useEffect(() => {
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
        if (!username || !password) {
          setError('Para ativar Face ID / Touch ID, preencha usuário e senha e mantenha conectado.');
        } else {
          const emailToUse = username.includes('@') ? username : `${username}@projeto.local`;
          const { error } = await onLogin(emailToUse, password);
          if (!error) {
            setBiometricsEnabled(true, username, password);
            setIsUpdatingSystem(true);
            onLoginSuccess?.();
          } else {
            setError('Credenciais inválidas para vincular biometria.');
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      setError('Autenticação biométrica cancelada ou não suportada.');
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

        auditLogService.logAction({
          action_type: 'login',
          module: 'auth',
          description: `Login efetuado com sucesso pelo usuário ${username.toUpperCase()}`,
          details: { email: emailToUse }
        });

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
        } catch (e) {
          console.error("Silent cache clear failed", e);
        }

        await new Promise(resolve => setTimeout(resolve, 2500));

        if (onLoginSuccess) {
          onLoginSuccess();
        }
        return;
      } else {
        setError('Credenciais inválidas. Verifique seu usuário e senha.');
        setLoading(false);
      }
    } catch (err) {
      setError('Erro ao conectar ao servidor. Verifique sua conexão.');
      setLoading(false);
    }
  };

  const logoUrl = getCachedImage(uiConfig?.loginLogoUrl || '', IMAGE_KEYS.loginLogoUrl) || uiConfig?.loginLogoUrl;

  return (
    <div 
      onMouseMove={handleMouseMove} 
      onMouseLeave={handleMouseLeave} 
      className="h-screen h-[100dvh] max-h-screen max-h-[100dvh] w-screen max-w-full overflow-hidden font-sans relative select-none bg-[#f4f7fb]"
    >

      {/* ========================================================================= */}
      {/* 1. BACKGROUND PANORÂMICO EM TELA CHEIA (100% VIEWPORT COM DEGRADÊ SUAVE)   */}
      {/* ========================================================================= */}
      <div className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-hidden">
        {/* Imagem de Alta Definição de São José do Goiabal cobrindo 100% da tela */}
        <img 
          src="/images/goiabal_panoramic_landscape.jpg" 
          alt="São José do Goiabal" 
          className="w-full h-full object-cover object-[25%_65%] lg:object-[35%_60%] filter brightness-[1.02] contrast-[1.03]"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          loading="eager"
        />

        {/* Efeito Degradê Conforme Modelo de Referência */}
        {/* Degradê superior suave para destacar a logo oficial e os títulos institucionais */}
        <div className="absolute top-0 left-0 right-0 h-48 lg:h-56 bg-gradient-to-b from-white/80 via-white/40 to-transparent"></div>

        {/* Degradê esquerdo para suavizar o céu atrás dos textos */}
        <div className="absolute top-0 left-0 bottom-0 w-full lg:w-[48%] bg-gradient-to-r from-white/70 via-white/35 to-transparent"></div>

        {/* Degradê direito luminoso e translúcido que cria a atmosfera clean para o Modal 3D */}
        <div className="absolute inset-0 bg-gradient-to-l from-[#f8fafc]/90 via-[#f8fafc]/55 to-transparent w-full lg:w-[56%] ml-auto"></div>

        {/* Degradê de profundidade na base onde descansam as ondas */}
        <div className="absolute bottom-0 left-0 right-0 h-44 bg-gradient-to-t from-[#081a33]/60 via-[#081a33]/15 to-transparent"></div>
      </div>

      {/* ========================================================================= */}
      {/* 2. ELEMENTOS GRÁFICOS DO MODELO: FOLHAGENS, PÍLULAS 3D E ONDAS ORGÂNICAS   */}
      {/* ========================================================================= */}

      {/* Folhagens Verdes Desfocadas no Canto Superior Direito (Bokeh / Profundidade de Campo) */}
      <div className="absolute -top-6 -right-6 w-60 sm:w-72 lg:w-80 h-60 sm:h-72 lg:h-80 pointer-events-none z-10 overflow-hidden opacity-90 filter blur-[1px]">
        <svg viewBox="0 0 240 240" className="w-full h-full drop-shadow-lg" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="leafGrad1" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#2d6a4f" />
              <stop offset="100%" stopColor="#1b4332" />
            </linearGradient>
            <linearGradient id="leafGrad2" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#52b788" />
              <stop offset="100%" stopColor="#2d6a4f" />
            </linearGradient>
            <linearGradient id="leafGrad3" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#40916c" />
              <stop offset="100%" stopColor="#1e4620" />
            </linearGradient>
          </defs>
          {/* Ramo Principal */}
          <path d="M240 0 C180 50 140 100 130 180" stroke="#2d4a22" strokeWidth="4" strokeLinecap="round" />
          {/* Folha 1 Superior */}
          <path d="M230 10 C180 30 140 80 155 130 C180 110 215 75 230 10 Z" fill="url(#leafGrad1)" />
          <path d="M230 10 C180 50 160 90 155 130" stroke="#52b788" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
          {/* Folha 2 Centro-Direita */}
          <path d="M240 60 C190 70 150 120 170 170 C195 145 225 115 240 60 Z" fill="url(#leafGrad2)" />
          <path d="M240 60 C200 90 180 130 170 170" stroke="#74c69d" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
          {/* Folha 3 Ponta Esquerda */}
          <path d="M190 0 C140 20 100 65 115 115 C140 95 170 65 190 0 Z" fill="url(#leafGrad3)" />
          {/* Folha 4 Pequena em primeiro plano */}
          <path d="M160 110 C125 135 110 170 125 200 C145 175 165 150 160 110 Z" fill="url(#leafGrad2)" opacity="0.85" />
          {/* Folha 5 Suave */}
          <path d="M210 130 C175 155 160 190 178 225 C198 198 215 170 210 130 Z" fill="url(#leafGrad1)" opacity="0.8" />
        </svg>
      </div>

      {/* Folhagem Natural na Borda Esquerda (Primeiro Plano conforme o modelo) */}
      <div className="absolute top-[38%] -left-6 sm:-left-4 w-32 sm:w-40 lg:w-48 h-48 sm:h-56 pointer-events-none z-10 overflow-hidden opacity-90 hidden sm:block">
        <svg viewBox="0 0 160 200" className="w-full h-full drop-shadow-md" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="leftLeafGrad1" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#40916c" />
              <stop offset="100%" stopColor="#1b4332" />
            </linearGradient>
            <linearGradient id="leftLeafGrad2" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#52b788" />
              <stop offset="100%" stopColor="#2d6a4f" />
            </linearGradient>
          </defs>
          <path d="M0 100 C40 85 80 80 120 40 C95 65 60 85 0 90 Z" fill="url(#leftLeafGrad1)" />
          <path d="M0 110 C50 105 100 120 140 95 C110 120 70 130 0 125 Z" fill="url(#leftLeafGrad2)" />
          <path d="M0 135 C45 140 85 160 115 185 C85 175 45 165 0 150 Z" fill="url(#leftLeafGrad1)" />
        </svg>
      </div>

      {/* Barras Diagonais 3D no Canto Inferior Direito (Conforme o Modelo) */}
      <div className="absolute -bottom-16 -right-16 pointer-events-none z-10 hidden lg:block select-none">
        <div className="relative w-80 xl:w-[420px] h-80 xl:h-[420px]">
          {/* Sombra difusa da composição tridimensional */}
          <div className="absolute bottom-20 right-20 w-80 h-20 bg-slate-900/15 rounded-full rotate-[-40deg] blur-2xl"></div>

          {/* Pílula Verde Esmeralda 3D (Vibrante e com chanfro de luz) */}
          <div className="absolute bottom-24 right-14 w-72 xl:w-[336px] h-14 bg-gradient-to-r from-[#10b981] via-[#059669] to-[#047857] rounded-full rotate-[-40deg] shadow-[0_16px_36px_rgba(16,185,129,0.38),inset_0_2px_4px_rgba(255,255,255,0.45),inset_0_-2px_4px_rgba(0,0,0,0.2)]"></div>

          {/* Pílula Azul Marinho Profundo 3D */}
          <div className="absolute bottom-8 right-24 w-80 xl:w-96 h-14 bg-gradient-to-r from-[#1e3a5f] via-[#0f294d] to-[#0c2340] rounded-full rotate-[-40deg] shadow-[0_22px_45px_rgba(12,35,64,0.42),inset_0_2px_4px_rgba(255,255,255,0.28),inset_0_-2px_4px_rgba(0,0,0,0.35)]"></div>

          {/* Sombra de apoio translúcida */}
          <div className="absolute -bottom-4 right-36 w-64 h-12 bg-emerald-500/25 backdrop-blur-sm rounded-full rotate-[-40deg]"></div>
        </div>
      </div>

      {/* Ondas Orgânicas Fluidas na Base (Lado Esquerdo e Centro) */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none z-10 overflow-hidden leading-none select-none">
        {/* Onda Verde Esmeralda */}
        <svg viewBox="0 0 1440 220" preserveAspectRatio="none" className="w-full h-24 sm:h-28 xl:h-32 text-emerald-500 filter drop-shadow-[0_-6px_18px_rgba(16,185,129,0.35)] opacity-95">
          <path d="M0,70 C300,165 620,-15 1080,105 C1260,145 1370,115 1440,85 L1440,220 L0,220 Z" fill="currentColor"></path>
        </svg>
        {/* Onda Azul Marinho Escura */}
        <svg viewBox="0 0 1440 220" preserveAspectRatio="none" className="w-full h-20 sm:h-24 xl:h-28 text-[#0c2340] -mt-16 sm:-mt-20 filter drop-shadow-[0_-10px_25px_rgba(12,35,64,0.45)]">
          <path d="M0,95 C340,25 700,155 1130,75 C1270,48 1370,82 1440,92 L1440,220 L0,220 Z" fill="currentColor"></path>
        </svg>
      </div>

      {/* ========================================================================= */}
      {/* 3. CONTEÚDO PRINCIPAL: 100% VIEWPORT SEM ROLAGEM                         */}
      {/* ========================================================================= */}
      <div className="relative z-20 w-full h-full max-h-screen flex flex-col lg:flex-row items-center justify-between p-4 sm:p-6 lg:p-8 xl:p-12 overflow-hidden">

        {/* ------------------------------------------------------------------------- */}
        {/* LADO ESQUERDO: Identidade Institucional de São José do Goiabal            */}
        {/* ------------------------------------------------------------------------- */}
        <div className="hidden lg:flex flex-col justify-between h-full w-[54%] xl:w-[56%] py-2 xl:py-4 select-none">
          
          {/* Bloco Superior: Logo, Título, Subtítulo e 3 Badges */}
          <div className="flex flex-col gap-3.5 xl:gap-4.5 max-w-xl">
            
            {/* Logo Oficial da Prefeitura (com dimensões rígidas contra estouro/FOUC) */}
            <div className="flex items-center gap-3.5 h-14 min-h-[56px]" style={{ minHeight: '56px' }}>
              {logoUrl ? (
                <img 
                  src={logoUrl} 
                  alt="Prefeitura de São José do Goiabal" 
                  className="h-12 xl:h-14 max-h-14 max-w-[260px] object-contain filter drop-shadow-md"
                  style={{ height: '52px', maxHeight: '56px', maxWidth: '260px', objectFit: 'contain' }}
                  loading="eager"
                />
              ) : (
                <div className="flex items-center gap-3.5">
                  <div 
                    className="w-14 h-14 rounded-2xl bg-white/95 shadow-md shadow-slate-900/10 border border-white p-1.5 flex items-center justify-center flex-shrink-0 overflow-hidden"
                    style={{ width: '56px', height: '56px', minWidth: '56px', minHeight: '56px', maxWidth: '56px', maxHeight: '56px' }}
                  >
                    <img 
                      src="/apple-touch-icon.png" 
                      alt="Brasão de São José do Goiabal" 
                      className="w-full h-full object-contain"
                      style={{ width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
                      width={56}
                      height={56}
                      loading="eager"
                    />
                  </div>
                  <div className="flex flex-col justify-center">
                    <span className="text-lg xl:text-xl font-black tracking-tight text-[#0c2340] uppercase leading-tight">
                      São José do Goiabal
                    </span>
                    <span className="text-[10px] xl:text-[11px] font-bold tracking-[0.38em] text-[#334e68] uppercase mt-0.5">
                      Prefeitura
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Títulos Principais */}
            <div className="space-y-1">
              <h2 className="text-xl xl:text-2xl font-semibold text-[#1e3a5f] tracking-tight">
                Bem-vindo ao
              </h2>
              <h1 className="text-3xl sm:text-4xl xl:text-[46px] font-black text-[#0c2340] tracking-tight leading-[1.1]">
                Sistema Municipal
              </h1>
              <p className="text-slate-600 text-xs sm:text-sm xl:text-base font-medium max-w-md pt-1 leading-relaxed">
                Mais agilidade, transparência e melhor atendimento para nossa gente.
              </p>
            </div>

            {/* Três Badges de Destaque com Efeito 3D e Sombras em Camadas */}
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3 pt-1 max-w-lg">
              
              {/* Badge 1: Segurança */}
              <div className="group bg-white/90 backdrop-blur-md rounded-2xl p-2.5 xl:p-3 border border-white/90 shadow-[0_10px_25px_rgba(15,35,65,0.08),inset_0_1px_2px_rgba(255,255,255,0.9)] hover:shadow-[0_14px_30px_rgba(15,35,65,0.16)] hover:-translate-y-1 transition-all duration-300 flex items-center gap-2.5 cursor-default">
                <div className="w-9 h-9 xl:w-10 xl:h-10 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-200 text-emerald-700 flex items-center justify-center flex-shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                  <ShieldCheck className="w-5 h-5 xl:w-5.5 xl:h-5.5" />
                </div>
                <div className="flex flex-col leading-tight min-w-0">
                  <span className="text-xs xl:text-sm font-black text-[#0c2340] truncate">Segurança</span>
                  <span className="text-[10px] xl:text-[11px] text-slate-500 font-medium truncate">dos seus dados</span>
                </div>
              </div>

              {/* Badge 2: Agilidade */}
              <div className="group bg-white/90 backdrop-blur-md rounded-2xl p-2.5 xl:p-3 border border-white/90 shadow-[0_10px_25px_rgba(15,35,65,0.08),inset_0_1px_2px_rgba(255,255,255,0.9)] hover:shadow-[0_14px_30px_rgba(15,35,65,0.16)] hover:-translate-y-1 transition-all duration-300 flex items-center gap-2.5 cursor-default">
                <div className="w-9 h-9 xl:w-10 xl:h-10 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 text-blue-700 flex items-center justify-center flex-shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                  <Zap className="w-5 h-5 xl:w-5.5 xl:h-5.5" />
                </div>
                <div className="flex flex-col leading-tight min-w-0">
                  <span className="text-xs xl:text-sm font-black text-[#0c2340] truncate">Agilidade</span>
                  <span className="text-[10px] xl:text-[11px] text-slate-500 font-medium truncate">nos processos</span>
                </div>
              </div>

              {/* Badge 3: Gestão */}
              <div className="group bg-white/90 backdrop-blur-md rounded-2xl p-2.5 xl:p-3 border border-white/90 shadow-[0_10px_25px_rgba(15,35,65,0.08),inset_0_1px_2px_rgba(255,255,255,0.9)] hover:shadow-[0_14px_30px_rgba(15,35,65,0.16)] hover:-translate-y-1 transition-all duration-300 flex items-center gap-2.5 cursor-default">
                <div className="w-9 h-9 xl:w-10 xl:h-10 rounded-xl bg-gradient-to-br from-purple-100 to-purple-200 text-purple-700 flex items-center justify-center flex-shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                  <Users className="w-5 h-5 xl:w-5.5 xl:h-5.5" />
                </div>
                <div className="flex flex-col leading-tight min-w-0">
                  <span className="text-xs xl:text-sm font-black text-[#0c2340] truncate">Gestão</span>
                  <span className="text-[10px] xl:text-[11px] text-slate-500 font-medium truncate">mais eficiente</span>
                </div>
              </div>

            </div>
          </div>

          {/* Bloco Inferior: Frase Manuscrita no topo da onda azul */}
          <div className="pb-3 xl:pb-5 pl-2 relative z-30">
            <span className="font-handwriting text-2xl sm:text-3xl xl:text-4xl text-white tracking-wide block drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] transform -rotate-2">
              Juntos por uma cidade melhor!
            </span>
            <svg className="w-44 xl:w-52 h-3 text-emerald-400 mt-0.5 filter drop-shadow" viewBox="0 0 200 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2 8 C 50 2, 120 12, 198 4" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
            </svg>
          </div>

        </div>

        {/* ------------------------------------------------------------------------- */}
        {/* LADO DIREITO: MODAL 3D DE LOGIN COM SOMBRAS E DINAMISMO                  */}
        {/* ------------------------------------------------------------------------- */}
        <div className="w-full lg:w-[44%] xl:w-[40%] h-full flex items-center justify-center lg:justify-end xl:pr-4">
          
          {/* Card Branco com Efeito 3D Marcante, Relevo e Sombras Multicamadas Dinâmicas */}
          <div 
            className="w-full max-w-[425px] xl:max-w-[445px] bg-white rounded-[32px] p-6 sm:p-7 xl:p-8 
              border border-slate-100/90 flex flex-col justify-between relative transition-all duration-300 
              group/card"
            style={{
              transform: `perspective(1000px) rotateX(${mouseOffset.y * -3.5}deg) rotateY(${mouseOffset.x * 3.5}deg) translateY(${mouseOffset.y * -2}px)`,
              boxShadow: `${mouseOffset.x * -8}px ${25 + mouseOffset.y * -6}px 65px -12px rgba(12,35,64,0.24), ${mouseOffset.x * -4}px ${12 + mouseOffset.y * -3}px 28px -6px rgba(12,35,64,0.12), inset 0 1px 2px rgba(255,255,255,0.95)`,
              transition: 'transform 0.15s ease-out, box-shadow 0.25s ease-out',
              willChange: 'transform, box-shadow'
            }}
          >
            {/* Brilho Sutil de Luz Superior e Feixe de Reflexo Dinâmico no Card 3D */}
            <div className="absolute top-0 left-8 right-8 h-[2px] bg-gradient-to-r from-transparent via-emerald-300/50 to-transparent rounded-full pointer-events-none"></div>
            <div 
              className="absolute inset-0 rounded-[32px] pointer-events-none transition-opacity duration-300 opacity-60"
              style={{
                background: `radial-gradient(circle at ${50 + mouseOffset.x * 35}% ${35 + mouseOffset.y * 35}%, rgba(255,255,255,0.45) 0%, transparent 65%)`
              }}
            ></div>
            
            {/* Header com Avatar Redondo e Badge 'Acesso seguro' */}
            <div>
              <div className="flex items-center justify-between mb-3">
                {/* Avatar com Degradê Verde Água / Menta 3D */}
                <div className="w-12 h-12 xl:w-13 xl:h-13 rounded-2xl bg-gradient-to-br from-[#34d399] via-[#10b981] to-[#059669] text-white flex items-center justify-center shadow-[0_6px_16px_rgba(16,185,129,0.35),inset_0_1px_2px_rgba(255,255,255,0.4)]">
                  <User className="w-6 h-6 xl:w-6.5 xl:h-6.5 drop-shadow-sm" />
                </div>

                {/* Badge Acesso Seguro */}
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50/90 border border-emerald-200/80 text-emerald-700 text-[10px] xl:text-[11px] font-bold shadow-sm">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Acesso seguro</span>
                </div>
              </div>

              <h3 className="text-2xl xl:text-3xl font-black text-[#0c2340] tracking-tight">
                Faça login
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                Para gerenciar seus documentos e acessar os serviços do sistema.
              </p>
            </div>

            {/* Formulário com Efeito 3D nos Inputs */}
            <form onSubmit={handleSubmit} className="space-y-3 xl:space-y-3.5 my-3 xl:my-3.5">
              
              {/* Campo Usuário */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">
                  Usuário
                </label>
                <div className="relative group">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toUpperCase())}
                    className="w-full pl-10 pr-4 py-2.5 sm:py-3 bg-slate-50/80 border border-slate-200/90 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 shadow-[inset_0_1px_3px_rgba(0,0,0,0.04)] outline-none transition-all duration-200 text-xs sm:text-sm font-medium"
                    placeholder="Digite seu usuário"
                    autoComplete="username"
                  />
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
                </div>
              </div>

              {/* Campo Senha */}
              <div className="space-y-1">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Senha
                  </label>
                  <button 
                    type="button" 
                    onClick={() => setShowForgotPasswordModal(true)}
                    className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
                <div className="relative group">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-10 py-2.5 sm:py-3 bg-slate-50/80 border border-slate-200/90 rounded-xl text-slate-800 placeholder-slate-400 focus:bg-white focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 shadow-[inset_0_1px_3px_rgba(0,0,0,0.04)] outline-none transition-all duration-200 text-xs sm:text-sm font-medium"
                    placeholder="Digite sua senha"
                    autoComplete="current-password"
                  />
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-emerald-600 transition-colors" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Switch Manter Conectado */}
              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-2.5 cursor-pointer select-none group">
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <div className={`w-9 h-5 rounded-full transition-colors duration-200 ${rememberMe ? 'bg-emerald-500 shadow-sm shadow-emerald-500/40' : 'bg-slate-200'}`}></div>
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200 shadow-sm ${rememberMe ? 'translate-x-4' : 'translate-x-0'}`}></div>
                  </div>
                  <span className="text-[11px] font-medium text-slate-600 group-hover:text-slate-900 transition-colors">
                    Manter conectado
                  </span>
                </label>
              </div>

              {/* Feedback de Erro */}
              {error && (
                <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-semibold text-center flex items-center justify-center gap-1.5 animate-shake shadow-sm">
                  <div className="w-1.5 h-1.5 bg-red-500 rounded-full flex-shrink-0"></div>
                  <span className="truncate">{error}</span>
                </div>
              )}

              {/* Botão Principal 3D: Entrar com Face ID / Touch ID */}
              <button
                type="button"
                onClick={handleBiometricLogin}
                disabled={loading}
                className="w-full py-3 px-4 bg-gradient-to-r from-[#10b981] via-[#059669] to-[#047857] hover:from-[#059669] hover:to-[#065f46] text-white font-bold rounded-xl text-xs sm:text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-[0_10px_25px_-3px_rgba(16,185,129,0.42),inset_0_1px_2px_rgba(255,255,255,0.3)] hover:shadow-[0_14px_30px_-3px_rgba(16,185,129,0.5)] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-[0_4px_10px_rgba(16,185,129,0.35)] disabled:opacity-50"
              >
                <ScanFace className="w-4.5 h-4.5 text-white drop-shadow-sm" />
                <span>Entrar com Face ID / Touch ID</span>
              </button>

              {/* Botão Secundário 3D: Entrar no sistema */}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 px-4 bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-slate-300 text-[#0c2340] font-bold rounded-xl text-xs sm:text-sm transition-all duration-200 flex items-center justify-center gap-2 shadow-[0_4px_12px_rgba(15,35,65,0.06)] hover:shadow-[0_8px_18px_rgba(15,35,65,0.12)] hover:-translate-y-0.5 active:translate-y-0.5 disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-slate-400 border-t-emerald-600 rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span>Entrar no sistema</span>
                    <ArrowRight className="w-4 h-4 text-slate-500" />
                  </>
                )}
              </button>
            </form>

            {/* Rodapé do Card: Ambiente seguro e Políticas com Rotas URL */}
            <div className="pt-2 text-center space-y-2 border-t border-slate-100">
              <div className="flex items-center justify-center gap-1.5 text-slate-400 text-[10px] xl:text-[11px] font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span>Ambiente seguro certificado</span>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] xl:text-[11px] text-blue-600 font-medium leading-none">
                <a
                  href="/PoliticaPrivacidade"
                  onClick={(e) => {
                    e.preventDefault();
                    window.history.pushState({}, '', '/PoliticaPrivacidade');
                    onNavigateView?.('politica-privacidade');
                  }}
                  className="hover:text-blue-800 hover:underline transition-colors"
                >
                  Política de Privacidade
                </a>
                <span className="text-slate-300">•</span>
                <a
                  href="/PoliticaPrivacidadeApp"
                  onClick={(e) => {
                    e.preventDefault();
                    window.history.pushState({}, '', '/PoliticaPrivacidadeApp');
                    onNavigateView?.('politica-privacidade-app');
                  }}
                  className="hover:text-blue-800 hover:underline transition-colors"
                >
                  Política de Privacidade do Aplicativo
                </a>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Modal: Esqueceu a Senha com Efeito 3D */}
      {showForgotPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[32px] p-6 sm:p-7 max-w-md w-full shadow-[0_25px_70px_rgba(0,0,0,0.3)] border border-slate-100 relative">
            <button
              onClick={() => setShowForgotPasswordModal(false)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3.5 shadow-sm">
              <KeyRound className="w-5 h-5" />
            </div>

            <h4 className="text-lg font-bold text-slate-800 mb-1.5">
              Recuperação de Acesso
            </h4>

            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-3.5">
              Por motivos de segurança e integridade das informações municipais, a redefinição de senhas de servidores é gerenciada diretamente pelo <strong>Departamento de Administração e TI</strong> da Prefeitura de São José do Goiabal.
            </p>

            <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/60 space-y-1.5 text-xs text-slate-600 mb-5 shadow-inner">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span><strong>Local:</strong> Praça Cônego João Pio, 30 – Centro</span>
              </div>
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span>Apresente documento de identificação oficial.</span>
              </div>
            </div>

            <button
              onClick={() => setShowForgotPasswordModal(false)}
              className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-xs sm:text-sm transition-all shadow-md shadow-emerald-600/20 active:scale-[0.98]"
            >
              Entendido
            </button>
          </div>
        </div>
      )}

      {/* Modal de Transição de Atualização do Sistema */}
      {isUpdatingSystem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[#0a0c10]/80 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-xl bg-white rounded-[2rem] shadow-[0_20px_80px_rgba(0,0,0,0.6)] border border-slate-200 p-8 sm:p-10 text-center relative overflow-hidden flex flex-col items-center">
            
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-blue-600"></div>
            
            <div className="relative z-10 flex flex-col items-center mb-6">
              <div className="w-16 h-16 mb-4 relative flex items-center justify-center">
                <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
                <div className="absolute inset-0 border-4 border-emerald-600 rounded-full border-t-transparent animate-spin"></div>
                <div className="w-8 h-8 bg-emerald-50 rounded-full flex items-center justify-center shadow-inner">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-slate-800 mb-1 tracking-tight">
                Preparando Ambiente
              </h3>
              <p className="text-slate-500 font-medium text-xs sm:text-sm">
                Carregando e otimizando módulos do sistema municipal...
              </p>
            </div>

            <div className="w-full relative z-10 h-[95px] flex items-center justify-center">
              {systemModules.map((mod, idx) => {
                const isActive = idx === currentModuleIdx;
                return (
                  <div 
                    key={idx}
                    className={`absolute transition-all duration-700 ease-in-out w-full max-w-md bg-white rounded-2xl p-4 border shadow-sm flex items-center gap-3.5
                      ${isActive ? 'opacity-100 translate-y-0 scale-100 z-20 ' + mod.border : 'opacity-0 translate-y-8 scale-90 z-0 border-slate-100'}`}
                  >
                    <div className={`w-11 h-11 rounded-xl flex-shrink-0 flex items-center justify-center ${mod.bg} ${mod.color} shadow-inner`}>
                      <mod.icon className="w-5 h-5" />
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-slate-800 mb-0.5 leading-tight truncate">{mod.name}</h4>
                      <p className="text-[11px] text-slate-500 font-medium leading-tight truncate">{mod.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex gap-1.5 z-10">
              {systemModules.map((_, idx) => (
                <div 
                  key={idx} 
                  className={`h-1.5 rounded-full transition-all duration-500 ${idx === currentModuleIdx ? 'w-6 bg-emerald-600' : 'w-1.5 bg-slate-200'}`}
                ></div>
              ))}
            </div>
            
          </div>
        </div>
      )}

      {/* Animação de Shake para Erro */}
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

    </div>
  );
};
