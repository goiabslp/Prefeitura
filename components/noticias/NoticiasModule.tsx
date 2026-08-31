import React, { useState, useEffect, useRef } from 'react';
import { User, BoletimMetricas, AppState, JornalMateria } from '../../types';
import { noticiasService, getSemanasDoMes, SemanaPeriodo } from '../../services/noticiasService';
import { BoletimStoryGenerator } from './BoletimStoryGenerator';
import { MateriaJornalPngModal, StoryMateriaJornalTemplate, generateAndDownloadStoryPng } from './MateriaJornalPngModal';
import {
  ArrowLeft,
  Newspaper,
  Calendar,
  Download,
  Loader2,
  Share2,
  TrendingUp,
  TrendingDown,
  Pill,
  Activity,
  Car,
  CheckCircle2,
  Clock,
  Sparkles,
  Star,
  Building2,
  MapPin,
  RefreshCw,
  Search,
  Filter,
  Eye,
  EyeOff,
  FileText,
  ChevronRight,
  Layers,
  BarChart3,
  Users,
  ShieldCheck,
  Quote,
  Bookmark,
  Printer,
  ChevronDown,
  Image as ImageIcon,
  Heart,
  Trash2,
  X,
  Lock
} from 'lucide-react';

interface NoticiasModuleProps {
  currentUser?: User | null;
  onBack: () => void;
  onNavigate?: (view: string) => void;
  subView?: string;
  appState?: AppState;
}

// Cache em memória a nível de módulo para abertura instantânea (0ms) sem flash
let moduleBoletimCache: BoletimMetricas | null = null;
let moduleMateriasCache: JornalMateria[] = [];

// Componente memoizado e ultra-otimizado para renderização 100% estática e fluida sem piscar
const PreloadedCardImage = React.memo<{
  src: string;
  alt: string;
  prefeituraLogoUrl?: string;
  destaque?: boolean;
  categoria?: string;
  oculta?: boolean;
  aprovada?: boolean;
  isAdmin?: boolean;
}>(({ src, alt, prefeituraLogoUrl, destaque, categoria, oculta, aprovada, isAdmin }) => {
  return (
    <div
      className="w-full h-48 sm:h-52 overflow-hidden relative bg-slate-200/80 shrink-0 select-none aspect-[16/10]"
      style={{ contain: 'layout paint' }}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 pointer-events-none"
      />

      {/* Badges superiores na imagem */}
      <div className="absolute top-3 left-3 flex items-center gap-1.5 flex-wrap z-10 pointer-events-none">
        {aprovada === false && (
          <span className="px-2.5 py-1 rounded-full bg-rose-600 text-white font-black text-[10px] uppercase flex items-center gap-1 shadow-md">
            <Clock className="w-3 h-3" /> Pendente de Aprovação
          </span>
        )}

        {destaque && (
          <span className="px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-[10px] uppercase flex items-center gap-1 shadow-md">
            <Star className="w-3 h-3 fill-slate-950 text-slate-950" /> Destaque
          </span>
        )}

        <span className="px-3 py-1 rounded-full bg-slate-900/85 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-wider shadow-sm">
          {categoria || 'GOVERNO & GESTÃO'}
        </span>

        {oculta && isAdmin && (
          <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-black uppercase flex items-center gap-1 shadow-sm">
            <EyeOff className="w-3 h-3" /> Oculta
          </span>
        )}
      </div>

      {/* Logo Prefeitura Marca d'água no canto da imagem */}
      {prefeituraLogoUrl && (
        <div className="absolute bottom-2.5 right-2.5 p-1 rounded-lg bg-white/90 backdrop-blur-sm shadow-sm z-10 pointer-events-none">
          <img
            src={prefeituraLogoUrl}
            alt="Logo"
            loading="lazy"
            decoding="async"
            className="h-4 max-w-[60px] object-contain"
          />
        </div>
      )}
    </div>
  );
});

// Card individual memoizado para evitar repaints de toda a lista de notícias durante o scroll
interface NewsCardItemProps {
  mat: JornalMateria;
  isAdmin: boolean;
  prefeituraLogoUrl?: string;
  onOpen: (mat: JornalMateria) => void;
  onAprovar: (id: string, e: React.MouseEvent) => void;
  onDownload: (mat: JornalMateria, e: React.MouseEvent) => void;
  onToggleDestaque: (id: string, e: React.MouseEvent) => void;
  onToggleOcultar: (id: string, e: React.MouseEvent) => void;
  onExcluir: (id: string, e: React.MouseEvent) => void;
  isDownloading: boolean;
}

const NewsCardItem = React.memo<NewsCardItemProps>(({
  mat,
  isAdmin,
  prefeituraLogoUrl,
  onOpen,
  onAprovar,
  onDownload,
  onToggleDestaque,
  onToggleOcultar,
  onExcluir,
  isDownloading
}) => {
  return (
    <article
      onClick={() => onOpen(mat)}
      style={{ contain: 'layout paint' }}
      className={`bg-white rounded-3xl border shadow-md hover:shadow-xl transition-shadow duration-200 overflow-hidden flex flex-col justify-between cursor-pointer group relative ${
        mat.aprovada === false
          ? 'ring-2 ring-rose-500 border-rose-500 bg-gradient-to-b from-rose-50/40 via-rose-50/10 to-white shadow-lg'
          : mat.destaque
          ? 'ring-2 ring-amber-400 border-amber-400 bg-gradient-to-b from-amber-50/20 to-white shadow-lg'
          : mat.oculta
          ? 'border-amber-300 bg-amber-50/20'
          : 'border-slate-200/90'
      }`}
    >
      <div>
        {mat.imagemUrl ? (
          <PreloadedCardImage
            src={mat.imagemUrl}
            alt={mat.titulo}
            prefeituraLogoUrl={prefeituraLogoUrl}
            destaque={mat.destaque}
            categoria={mat.categoria}
            oculta={mat.oculta}
            aprovada={mat.aprovada}
            isAdmin={isAdmin}
          />
        ) : (
          <div className="w-full h-24 bg-gradient-to-r from-slate-900 to-indigo-950 p-4 flex items-center justify-between text-white relative">
            <div className="flex items-center gap-2">
              {mat.aprovada === false && (
                <span className="px-2.5 py-1 rounded-full bg-rose-600 text-white font-black text-[10px] uppercase flex items-center gap-1 shadow-sm animate-pulse">
                  <Clock className="w-3 h-3" /> Pendente
                </span>
              )}

              {mat.destaque && (
                <span className="px-2.5 py-1 rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 font-black text-[10px] uppercase flex items-center gap-1 shadow-sm">
                  <Star className="w-3 h-3 fill-slate-950 text-slate-950" /> Destaque
                </span>
              )}

              {prefeituraLogoUrl ? (
                <div className="p-1 rounded bg-white/10 backdrop-blur-sm">
                  <img src={prefeituraLogoUrl} alt="Logo" className="h-5 object-contain" />
                </div>
              ) : (
                <span className="px-2.5 py-1 rounded bg-white/20 text-white text-[10px] font-black uppercase tracking-wider">
                  {mat.categoria || 'COMUNICAÇÃO OFICIAL'}
                </span>
              )}
            </div>

            {mat.oculta && isAdmin && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-black uppercase flex items-center gap-1 shadow-sm">
                <EyeOff className="w-3 h-3" /> Oculta
              </span>
            )}
            
            <Newspaper className="w-6 h-6 text-indigo-300 opacity-60" />
          </div>
        )}

        <div className="p-6 space-y-3">
          {/* Data e Autoria */}
          <div className="flex items-center justify-between text-[11px] font-sans text-slate-400 font-bold border-b border-slate-100 pb-2">
            <span className="flex items-center gap-1.5 text-indigo-600">
              <Calendar className="w-3.5 h-3.5" />
              {new Date(mat.dataPublicacao).toLocaleDateString('pt-BR')}
            </span>
            <span className="truncate max-w-[150px]">{mat.autor}</span>
          </div>

          {/* Manchete */}
          <h4 className="text-lg sm:text-xl font-serif font-black tracking-tight text-slate-950 leading-snug group-hover:text-indigo-600 transition-colors line-clamp-2">
            {mat.titulo}
          </h4>

          {/* Subtítulo / Lead */}
          <p className="text-xs font-serif text-slate-600 line-clamp-3 leading-relaxed">
            {mat.subtitulo}
          </p>

          {/* Aspas em Destaque se houver */}
          {mat.destaqueFrase && (
            <blockquote className="bg-slate-50 border-l-2 border-indigo-600 p-2.5 rounded-r-xl text-[11px] font-serif italic text-slate-700 line-clamp-2">
              "{mat.destaqueFrase.replace(/^["“”«»'\s]+|["“”«»'\s]+$/g, '')}"
            </blockquote>
          )}
        </div>
      </div>

      <div className="px-6 py-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between font-sans gap-2">
        <span className="text-xs font-black text-indigo-600 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
          Ler Matéria <ChevronRight className="w-3.5 h-3.5" />
        </span>

        <div className="flex items-center gap-1.5">
          {/* Botão de Aprovação e Publicação Direta (Exclusivo Administrador) */}
          {isAdmin && mat.aprovada === false && (
            <button
              type="button"
              onClick={(e) => onAprovar(mat.id, e)}
              className="px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-[11px] font-black shadow-sm flex items-center gap-1 transition-all active:scale-95 cursor-pointer shrink-0"
              title="Aprovar e Publicar Matéria no Jornal Oficial"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Aprovar</span>
            </button>
          )}

          {/* Botão Baixar Matéria em Formato de Jornal PNG */}
          <button
            type="button"
            onClick={(e) => onDownload(mat, e)}
            disabled={isDownloading}
            className="p-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-900 transition-all flex items-center justify-center shadow-2xs cursor-pointer active:scale-95 border border-indigo-100 disabled:opacity-60"
            title="Baixar matéria em formato de jornal (PNG 1080x1920)"
          >
            {isDownloading ? (
              <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
            ) : (
              <Download className="w-4 h-4 text-indigo-600" />
            )}
          </button>

          {/* Ações Exclusivas do Administrador: Destaque, Ocultar e Excluir */}
          {isAdmin && (
            <>
              {/* Botão Colocar/Remover Destaque Principal */}
              <button
                type="button"
                onClick={(e) => onToggleDestaque(mat.id, e)}
                className={`p-2 rounded-xl transition-all flex items-center justify-center border cursor-pointer active:scale-95 shadow-2xs ${
                  mat.destaque
                    ? 'text-amber-950 bg-gradient-to-r from-amber-200 to-yellow-300 border-amber-400 hover:from-amber-300 hover:to-yellow-400 shadow-sm'
                    : 'text-slate-500 bg-white border-slate-200 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200'
                }`}
                title={mat.destaque ? 'Remover destaque principal' : 'Colocar matéria em destaque principal'}
              >
                <Star className={`w-4 h-4 ${mat.destaque ? 'fill-amber-900 text-amber-900' : 'text-slate-500'}`} />
              </button>

              {/* Botão Ocultar/Reexibir */}
              <button
                type="button"
                onClick={(e) => onToggleOcultar(mat.id, e)}
                className={`p-2 rounded-xl transition-all flex items-center justify-center border cursor-pointer active:scale-95 shadow-2xs ${
                  mat.oculta
                    ? 'text-amber-900 bg-amber-100 border-amber-300 hover:bg-amber-200'
                    : 'text-slate-500 bg-white border-slate-200 hover:bg-slate-100 hover:text-indigo-600'
                }`}
                title={mat.oculta ? 'Reexibir matéria para o público' : 'Ocultar matéria do público'}
              >
                {mat.oculta ? <EyeOff className="w-4 h-4 text-amber-700" /> : <Eye className="w-4 h-4 text-slate-500" />}
              </button>

              {/* Botão Excluir */}
              <button
                type="button"
                onClick={(e) => onExcluir(mat.id, e)}
                className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-colors cursor-pointer flex items-center justify-center"
                title="Excluir matéria (Administrador)"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
});

// Skeleton placeholder moderno para carregamento suave sem salto de layout
const NoticiasSkeletonGrid: React.FC = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
    {[1, 2, 3, 4, 5, 6].map((i) => (
      <div key={i} className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm animate-pulse flex flex-col justify-between">
        <div>
          <div className="w-full h-48 sm:h-52 bg-slate-200" />
          <div className="p-6 space-y-3">
            <div className="h-3 w-28 bg-slate-200 rounded-full" />
            <div className="h-6 w-5/6 bg-slate-200 rounded-lg" />
            <div className="h-3 w-full bg-slate-200 rounded" />
            <div className="h-3 w-4/5 bg-slate-200 rounded" />
          </div>
        </div>
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <div className="h-4 w-20 bg-slate-200 rounded" />
          <div className="h-8 w-8 bg-slate-200 rounded-xl" />
        </div>
      </div>
    ))}
  </div>
);

export const NoticiasModule: React.FC<NoticiasModuleProps> = ({
  currentUser,
  onBack,
  onNavigate,
  subView,
  appState
}) => {
  const [loading, setLoading] = useState<boolean>(() => !moduleBoletimCache);
  const [boletim, setBoletim] = useState<BoletimMetricas | null>(() => moduleBoletimCache);
  
  // Padrão obrigatório: "Mensal"
  const [tipoSelecionado, setTipoSelecionado] = useState<'Semanal' | 'Mensal'>('Mensal');
  
  // Matérias publicadas pelo Calendário / IA (com inicialização imediata do cache)
  const [materiasPublicadas, setMateriasPublicadas] = useState<JornalMateria[]>(() => moduleMateriasCache);
  const [materiaAberta, setMateriaAberta] = useState<JornalMateria | null>(null);
  const [materiaParaExportarPng, setMateriaParaExportarPng] = useState<JornalMateria | null>(null);
  
  // Download Direto Imediato de Matéria
  const [baixandoMateriaId, setBaixandoMateriaId] = useState<string | null>(null);
  const [materiaParaDownloadDireto, setMateriaParaDownloadDireto] = useState<JornalMateria | null>(null);
  const directDownloadRef = useRef<HTMLDivElement>(null);
  
  // Datas para seleção
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth()); // 0-11
  const [selectedSemana, setSelectedSemana] = useState<number>(1);
  
  const [historico, setHistorico] = useState<Array<{ id: string; titulo: string; tipo: 'Semanal' | 'Mensal'; periodo: string; mes: number; ano: number; semana?: number }>>([]);
  const [historicoSearch, setHistoricoSearch] = useState<string>('');
  const [historicoTipoFilter, setHistoricoTipoFilter] = useState<'Todos' | 'Semanal' | 'Mensal'>('Todos');

  // Visibilidade de Matérias e Seções Automáticas (Controle de Administrador)
  interface SecoesVisibilidade {
    manchete: boolean;
    reportagensCalendario: boolean;
    farmacia: boolean;
    consultas: boolean;
    transporte: boolean;
    balancoGeral: boolean;
  }

  const [secoesVisibilidade, setSecoesVisibilidade] = useState<SecoesVisibilidade>(() => {
    try {
      const saved = localStorage.getItem('prefeitura_noticias_visibilidade_secoes');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      manchete: true,
      reportagensCalendario: true,
      farmacia: true,
      consultas: true,
      transporte: true,
      balancoGeral: true
    };
  });

  const [isGerenciarVisibilidadeOpen, setIsGerenciarVisibilidadeOpen] = useState<boolean>(false);

  const toggleSecao = (key: keyof SecoesVisibilidade) => {
    if (!isAdmin) {
      showNotification('Apenas Administradores podem alterar a visibilidade das matérias.');
      return;
    }
    setSecoesVisibilidade(prev => {
      const updated = { ...prev, [key]: !prev[key] };
      localStorage.setItem('prefeitura_noticias_visibilidade_secoes', JSON.stringify(updated));
      showNotification(updated[key] ? 'Matéria/seção visível publicamente.' : 'Matéria/seção ocultada do público.');
      return updated;
    });
  };

  // Modal do Gerador de Stories
  const [isStoryModalOpen, setIsStoryModalOpen] = useState<boolean>(false);
  const [isTourOpen, setIsTourOpen] = useState<boolean>(subView === 'tour');
  const [notification, setNotification] = useState<string | null>(null);

  // 🛡️ Verificação de Administrador (somente administradores podem excluir, ocultar ou alterar destaques)
  const userRoleStr = (currentUser as any)?.role ? String((currentUser as any).role).toLowerCase() : '';
  const userRealRoleStr = (currentUser as any)?.realRole ? String((currentUser as any).realRole).toLowerCase() : '';
  const userLevelStr = (currentUser as any)?.level ? String((currentUser as any).level).toLowerCase() : '';
  const usernameStr = (currentUser as any)?.username ? String((currentUser as any).username).toLowerCase() : '';
  const isAdmin = userRoleStr === 'admin' ||
                  userRoleStr === 'administrador' ||
                  userRealRoleStr === 'admin' ||
                  userRealRoleStr === 'administrador' ||
                  userLevelStr === 'admin' ||
                  userLevelStr === 'administrador' ||
                  usernameStr === 'admin';

  // 🏛️ Logo Oficial da Prefeitura
  const prefeituraLogoUrl = appState?.branding?.logoUrl ||
                           appState?.ui?.headerLogoUrl ||
                           appState?.ui?.loginLogoUrl ||
                           localStorage.getItem('prefeitura_logo_url') ||
                           '';

  const MESES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const semanasDisponiveis = getSemanasDoMes(selectedYear, selectedMonth);

  // Sincronizar subView com o tipo de boletim e a URL
  useEffect(() => {
    if (subView === 'boletim-semanal') {
      setTipoSelecionado('Semanal');
    } else {
      // Padrão: Mensal
      setTipoSelecionado('Mensal');
    }
  }, [subView]);

  // Inicializar semana com a semana atual baseada no dia
  useEffect(() => {
    const today = new Date();
    const day = today.getDate();
    let sem = 1;
    if (day <= 7) sem = 1;
    else if (day <= 14) sem = 2;
    else if (day <= 21) sem = 3;
    else if (day <= 28) sem = 4;
    else sem = 5;
    setSelectedSemana(Math.min(sem, semanasDisponiveis.length));
  }, [selectedYear, selectedMonth]);

  // Carregar Boletim e Matérias Publicadas com Cache Transparente
  const loadBoletim = async () => {
    if (!moduleBoletimCache) {
      setLoading(true);
    }
    try {
      const [data, hist, mats] = await Promise.all([
        noticiasService.gerarBoletim(
          tipoSelecionado,
          selectedYear,
          selectedMonth,
          tipoSelecionado === 'Semanal' ? selectedSemana : undefined
        ),
        noticiasService.getHistoricoBoletins(),
        noticiasService.getMateriasPublicadas()
      ]);
      setBoletim(data);
      setHistorico(hist);
      setMateriasPublicadas(mats);
      moduleBoletimCache = data;
      moduleMateriasCache = mats;
    } catch (err) {
      console.error('Erro ao carregar boletim e matérias:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBoletim();
  }, [tipoSelecionado, selectedYear, selectedMonth, selectedSemana]);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  // Excluir Matéria (Exclusivo Administrador)
  const handleExcluirMateria = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAdmin) {
      showNotification('Apenas Administradores podem excluir matérias.');
      return;
    }
    if (confirm('Deseja realmente excluir esta matéria do jornal? Esta ação não pode ser desfeita.')) {
      await noticiasService.excluirMateria(id);
      setMateriasPublicadas(prev => prev.filter(m => m.id !== id));
      if (materiaAberta?.id === id) setMateriaAberta(null);
      showNotification('Matéria excluída com sucesso.');
    }
  };

  // Aprovar e Publicar Matéria no Jornal Oficial (Exclusivo Administrador)
  const handleAprovarMateria = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!isAdmin) {
      showNotification('Apenas Administradores podem aprovar matérias.');
      return;
    }
    try {
      const res = await noticiasService.aprovarMateria(id);
      if (res.success) {
        setMateriasPublicadas(prev => prev.map(m => m.id === id ? { ...m, aprovada: true, status: 'publicada' } : m));
        if (materiaAberta && materiaAberta.id === id) {
          setMateriaAberta(prev => prev ? { ...prev, aprovada: true, status: 'publicada' } : null);
        }
        showNotification('✅ Matéria aprovada e publicada no Jornal Oficial com sucesso!');
      } else {
        showNotification('Erro ao aprovar matéria. Tente novamente.');
      }
    } catch (err) {
      console.error('Erro ao aprovar matéria:', err);
      showNotification('Erro ao processar aprovação da matéria.');
    }
  };

  // Ocultar / Reexibir Matéria (Exclusivo Administrador)
  const handleToggleOcultarMateria = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAdmin) {
      showNotification('Apenas Administradores podem ocultar matérias.');
      return;
    }
    const res = await noticiasService.toggleOcultarMateria(id);
    if (res.success) {
      setMateriasPublicadas(prev => prev.map(m => m.id === id ? { ...m, oculta: res.oculta } : m));
      showNotification(res.oculta ? 'Matéria ocultada do público.' : 'Matéria visível publicamente.');
    }
  };

  const handleToggleDestaqueMateria = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      const matAtual = materiasPublicadas.find(m => m.id === id);
      const novoDestaque = !matAtual?.destaque;

      const res = await noticiasService.toggleDestaqueMateria(id);
      if (res.success) {
        setMateriasPublicadas(prev => {
          const updated = prev.map(m => {
            if (m.id === id) return { ...m, destaque: res.destaque };
            // Se ativou destaque para esta matéria, torna as outras normais para ter uma única Capa de Manchete
            if (res.destaque) return { ...m, destaque: false };
            return m;
          });
          return updated.sort((a, b) => {
            if (a.destaque && !b.destaque) return -1;
            if (!a.destaque && b.destaque) return 1;
            return new Date(b.dataPublicacao || 0).getTime() - new Date(a.dataPublicacao || 0).getTime();
          });
        });
        if (materiaAberta && materiaAberta.id === id) {
          setMateriaAberta(prev => prev ? { ...prev, destaque: res.destaque } : null);
        }
        showNotification(res.destaque ? '⭐ Matéria definida como Capa da Manchete Principal!' : 'Destaque de capa removido.');
      }
    } catch (err) {
      console.error('Erro ao alternar destaque:', err);
      showNotification('Erro ao atualizar destaque da matéria.');
    }
  };

  const handleMudarTipo = (tipo: 'Semanal' | 'Mensal') => {
    if (!isAdmin) {
      showNotification('Apenas Administradores podem alternar o formato do boletim.');
      return;
    }
    setTipoSelecionado(tipo);
    if (tipo === 'Semanal') {
      if (onNavigate) onNavigate('noticias:boletim-semanal');
      else window.history.pushState({}, '', '/Noticias/BoletimSemanal');
    } else {
      if (onNavigate) onNavigate('noticias:boletim-mensal');
      else window.history.pushState({}, '', '/Noticias/BoletimMensal');
    }
  };

  // Download Imediato de uma Matéria individual no padrão oficial do jornal
  const handleDownloadImediato = async (mat: JornalMateria, e: React.MouseEvent) => {
    e.stopPropagation();
    if (baixandoMateriaId) return;

    setBaixandoMateriaId(mat.id);
    setMateriaParaDownloadDireto(mat);

    setTimeout(async () => {
      try {
        if (directDownloadRef.current) {
          await generateAndDownloadStoryPng(mat, directDownloadRef.current, (msg) => {
            showNotification(msg);
          });
        }
      } catch (err) {
        console.error('Erro no download direto:', err);
        showNotification('Erro ao gerar imagem. Tente novamente.');
      } finally {
        setBaixandoMateriaId(null);
        setMateriaParaDownloadDireto(null);
      }
    }, 150);
  };

  // Filtrar matérias: Usuários comuns só vêem as que estão APROVADAS e NÃO estão ocultas. Administradores vêem todas (inclusive pendentes).
  const materiasParaExibicao = materiasPublicadas.filter(m => {
    if (isAdmin) return true;
    return m.aprovada !== false && !m.oculta;
  });

  // Matéria selecionada para ser a Capa da Manchete Principal
  const materiaDestaqueCapa = materiasParaExibicao.find(m => m.destaque);

  // Pré-carregamento imediato e em segundo plano de todas as fotos de matérias e logomarca
  useEffect(() => {
    if (prefeituraLogoUrl) {
      const img = new window.Image();
      img.src = prefeituraLogoUrl;
    }
    if (materiasPublicadas && materiasPublicadas.length > 0) {
      materiasPublicadas.forEach((mat) => {
        if (mat.imagemUrl) {
          const img = new window.Image();
          img.src = mat.imagemUrl;
        }
      });
    }
  }, [materiasPublicadas, prefeituraLogoUrl]);

  const hojeFormatado = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(new Date());

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  // Totais agregados para a manchete
  const totalGeralAtendimentos = boletim
    ? boletim.farmacia.totalMedicamentosDispensados +
      boletim.consultas.totalAgendamentos +
      boletim.veiculos.totalPassageiros
    : 0;

  return (
    <div className="h-full w-full bg-[#f8fafc] text-slate-800 flex flex-col font-serif overflow-y-auto custom-scrollbar pb-24 selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* ========================================================================= */}
      {/* 1. TOP HEADER / MASTHEAD COMPACTO DO JORNAL OFICIAL */}
      {/* ========================================================================= */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm font-sans">
        <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 flex items-center justify-between gap-2 sm:gap-3">
          
          {/* Lado Esquerdo: Voltar + Título Compacto + Data */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onBack}
              className="p-1.5 sm:p-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 transition-all active:scale-95 cursor-pointer shrink-0"
              title="Voltar ao Início"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 shrink-0">
              <h1 className="text-sm sm:text-base font-serif font-black tracking-tight text-slate-950 uppercase leading-none">
                Jornal Oficial
              </h1>
              <span className="hidden sm:inline-flex px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-extrabold text-[10px] uppercase">
                {tipoSelecionado === 'Mensal' ? 'Edição Mensal' : 'Edição Semanal'}
              </span>
              <span className="hidden lg:inline text-slate-300">•</span>
              <span className="hidden lg:inline text-[11px] font-semibold text-slate-500 whitespace-nowrap">
                {capitalize(hojeFormatado)}
              </span>
            </div>
          </div>

          {/* Lado Direito / Ações: Período + Gerenciar Visibilidade + Atualizar + Stories */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {isAdmin ? (
              /* MODO ADMINISTRADOR: Permite selecionar período e formato */
              <div className="flex items-center gap-1 bg-indigo-50/70 p-0.5 sm:p-1 rounded-2xl border border-indigo-200/80 animate-in fade-in shrink-0">
                <div className="flex items-center bg-white p-0.5 rounded-xl border border-slate-200 shadow-xs">
                  <button
                    onClick={() => handleMudarTipo('Mensal')}
                    className={`px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
                      tipoSelecionado === 'Mensal'
                        ? 'bg-indigo-600 text-white shadow-sm font-black'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    📊 Mensal
                  </button>
                  <button
                    onClick={() => handleMudarTipo('Semanal')}
                    className={`px-2 sm:px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
                      tipoSelecionado === 'Semanal'
                        ? 'bg-indigo-600 text-white shadow-sm font-black'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    📰 Semanal
                  </button>
                </div>

                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="bg-white border border-slate-300 rounded-xl px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-bold text-slate-800 outline-none cursor-pointer focus:border-indigo-500 shadow-xs"
                >
                  {MESES.map((m, idx) => (
                    <option key={idx} value={idx}>{m} / {selectedYear}</option>
                  ))}
                </select>

                {tipoSelecionado === 'Semanal' && (
                  <select
                    value={selectedSemana}
                    onChange={(e) => setSelectedSemana(Number(e.target.value))}
                    className="bg-white border border-slate-300 rounded-xl px-2 py-1 text-[11px] sm:text-xs font-bold text-slate-800 outline-none cursor-pointer focus:border-indigo-500 shadow-xs"
                  >
                    {semanasDisponiveis.map((s) => (
                      <option key={s.numero} value={s.numero}>{s.titulo}</option>
                    ))}
                  </select>
                )}

                <span className="hidden sm:inline-block px-1.5 py-0.5 rounded-md bg-indigo-600 text-white text-[9px] font-black uppercase tracking-wider">
                  Admin
                </span>
              </div>
            ) : (
              /* MODO PÚBLICO / USUÁRIO: Período consolidado fixo mensal */
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-slate-100 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold shrink-0">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>{MESES[selectedMonth]} de {selectedYear}</span>
              </div>
            )}

            {/* Atualizar */}
            <button
              onClick={() => loadBoletim()}
              disabled={loading}
              className="p-2 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-sm shrink-0"
              title="Atualizar dados em tempo real"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
          </div>

        </div>
      </header>

      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-slate-700 animate-in fade-in slide-in-from-bottom duration-300 font-sans">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs font-bold">{notification}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. CORPO DO JORNAL (LAYOUT EDITORIAL DIVIDIDO EM MATÉRIAS) */}
      {/* ========================================================================= */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        
        {loading ? (
          <div className="py-24 text-center space-y-4 font-sans">
            <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin mx-auto" />
            <p className="text-slate-600 font-bold text-sm uppercase tracking-wider">
              Formatando edição do jornal com métricas em tempo real...
            </p>
          </div>
        ) : boletim ? (
          <div className="space-y-12">

            {/* ------------------------------------------------------------------- */}
            {/* MANCHETE PRINCIPAL DE CAPA (MAIS RECENTE NO TOPO) */}
            {/* ------------------------------------------------------------------- */}
            {(secoesVisibilidade.manchete || isAdmin) && (
              <article className={`bg-white rounded-3xl border-2 shadow-lg p-6 sm:p-10 relative overflow-hidden transition-all ${
                !secoesVisibilidade.manchete ? 'border-amber-400 bg-amber-50/20' : 'border-slate-900/10'
              }`}>
                {/* Badge e Botão de Ocultar para Administrador */}
                {isAdmin && (
                  <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
                    {!secoesVisibilidade.manchete && (
                      <span className="px-2.5 py-1 rounded-full bg-amber-500 text-white text-[10px] font-black uppercase flex items-center gap-1 shadow-sm font-sans">
                        <EyeOff className="w-3.5 h-3.5" /> Oculto do Público
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleSecao('manchete')}
                      className={`p-2 rounded-xl transition-all cursor-pointer font-sans text-xs font-bold flex items-center gap-1.5 shadow-xs border ${
                        !secoesVisibilidade.manchete
                          ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 hover:text-indigo-600'
                      }`}
                      title={!secoesVisibilidade.manchete ? 'Reexibir manchete para o público' : 'Ocultar manchete do público'}
                    >
                      {!secoesVisibilidade.manchete ? <Eye className="w-4 h-4 text-amber-700" /> : <EyeOff className="w-4 h-4 text-slate-500" />}
                      <span className="hidden sm:inline">{!secoesVisibilidade.manchete ? 'Reexibir' : 'Ocultar'}</span>
                    </button>
                  </div>
                )}

                {materiaDestaqueCapa ? (
                  /* ========================================================================= */
                  /* CAPA DA MANCHETE: MATÉRIA EM DESTAQUE */
                  /* ========================================================================= */
                  <div
                    className="w-full cursor-pointer group"
                    onClick={() => setMateriaAberta(materiaDestaqueCapa)}
                  >
                    {/* Manchete, Imagem e Lead da Matéria em Destaque */}
                    <div className="w-full space-y-4">
                      <div className="flex items-center gap-2 font-sans flex-wrap">
                        <span className="px-2.5 py-1 rounded-md bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 shadow-xs">
                          <Star className="w-3 h-3 fill-slate-950 text-slate-950" /> Manchete de Capa • Destaque
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider">
                          {materiaDestaqueCapa.categoria || 'GOVERNO & GESTÃO'}
                        </span>
                        <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                          {new Date(materiaDestaqueCapa.dataPublicacao).toLocaleDateString('pt-BR')}
                        </span>
                      </div>

                      {/* Imagem de Capa compacta e elegante */}
                      {materiaDestaqueCapa.imagemUrl && (
                        <div className="w-full h-48 sm:h-64 rounded-2xl overflow-hidden shadow-sm bg-slate-100 relative shrink-0">
                          <img
                            src={materiaDestaqueCapa.imagemUrl}
                            alt={materiaDestaqueCapa.titulo}
                            loading="eager"
                            decoding="async"
                            className="w-full h-full object-cover group-hover:scale-[1.01] transition-transform duration-300 pointer-events-none"
                          />
                          {prefeituraLogoUrl && (
                            <div className="absolute bottom-2.5 right-2.5 p-1 rounded-lg bg-white/90 backdrop-blur-sm shadow-xs pointer-events-none">
                              <img src={prefeituraLogoUrl} alt="Logo" className="h-4 max-w-[70px] object-contain" />
                            </div>
                          )}
                        </div>
                      )}

                      {/* Título Principal de Capa */}
                      <h2 className="text-xl sm:text-2xl lg:text-3xl font-serif font-black tracking-tight text-slate-950 leading-snug group-hover:text-indigo-600 transition-colors">
                        {materiaDestaqueCapa.titulo}
                      </h2>

                      {/* Lead Jornalístico */}
                      <p className="text-sm sm:text-base font-serif text-slate-600 leading-relaxed font-normal italic border-l-4 border-amber-400 pl-3 py-0.5">
                        "{materiaDestaqueCapa.subtitulo}"
                      </p>

                      {materiaDestaqueCapa.destaqueFrase && (
                        <blockquote className="bg-slate-50 border-l-2 border-indigo-600 p-2.5 rounded-r-xl text-xs sm:text-sm font-serif italic text-slate-700">
                          "{materiaDestaqueCapa.destaqueFrase.replace(/^["“”«»'\s]+|["“”«»'\s]+$/g, '')}"
                        </blockquote>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <div className="flex items-center gap-2.5 text-xs font-sans text-slate-500 font-semibold">
                          {prefeituraLogoUrl && (
                            <img src={prefeituraLogoUrl} alt="Logo" className="h-3.5 object-contain" />
                          )}
                          <span>Por <strong>{materiaDestaqueCapa.autor}</strong></span>
                        </div>

                        <span className="text-xs font-black text-indigo-600 flex items-center gap-1 font-sans group-hover:translate-x-1 transition-transform">
                          Ler Reportagem Completa <ChevronRight className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* ========================================================================= */
                  /* CAPA DA MANCHETE: BALANÇO GERAL PADRÃO */
                  /* ========================================================================= */
                  <div className="w-full space-y-4">
                    <div className="flex items-center gap-2.5 font-sans">
                      <span className="px-3 py-1 rounded-md bg-red-600 text-white text-[10px] font-black uppercase tracking-widest animate-pulse">
                        Manchete da Edição
                      </span>
                      <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                        Período de {boletim.dataInicio.split('-')[2]}/{boletim.dataInicio.split('-')[1]} a {boletim.dataFim.split('-')[2]}/{boletim.dataFim.split('-')[1]}/{boletim.ano}
                      </span>
                    </div>

                    {/* Título Principal de Capa */}
                    <h2 className="text-2xl sm:text-3xl font-serif font-black tracking-tight text-slate-950 leading-tight">
                      {boletim.tipo === 'Mensal'
                        ? `Balanço Mensal: Administração consolida mais de ${totalGeralAtendimentos.toLocaleString('pt-BR')} atendimentos e serviços prestados no município`
                        : `Boletim Semanal: Saúde e Transporte superam metas com ${totalGeralAtendimentos.toLocaleString('pt-BR')} procedimentos realizados na Semana ${boletim.numeroSemana || ''}`}
                    </h2>

                    {/* Lead Jornalístico */}
                    <p className="text-base sm:text-lg font-serif text-slate-700 leading-relaxed font-normal italic border-l-4 border-indigo-600 pl-4 py-1">
                      "{boletim.descricao} Levantamento oficial reúne dados da Farmácia Popular, Regulação de Especialidades Médicas e Frota Municipal de Veículos."
                    </p>

                    <div className="flex items-center gap-4 text-xs font-sans text-slate-500 font-semibold pt-2 border-t border-slate-100">
                      {prefeituraLogoUrl && (
                        <img src={prefeituraLogoUrl} alt="Logo" className="h-4 object-contain" />
                      )}
                      <span>Por <strong>Redação Oficial de Comunicação & Transparência</strong></span>
                      <span>•</span>
                      <span>Prefeitura Municipal de São José do Goiabal</span>
                    </div>
                  </div>
                )}
              </article>
            )}

            {/* ------------------------------------------------------------------- */}
            {/* REPORTAGENS & ACONTECIMENTOS OFICIAIS PUBLICADOS DO CALENDÁRIO (IA) */}
            {/* ------------------------------------------------------------------- */}
            {materiasParaExibicao.length > 0 && (secoesVisibilidade.reportagensCalendario || isAdmin) && (
              <section className={`space-y-6 rounded-3xl p-4 sm:p-6 transition-all ${
                !secoesVisibilidade.reportagensCalendario ? 'border-2 border-amber-400 bg-amber-50/20' : ''
              }`}>
                <div className="flex items-center justify-between border-b-2 border-slate-900/10 pb-3">
                  <div className="flex items-center gap-3">
                    {prefeituraLogoUrl ? (
                      <img src={prefeituraLogoUrl} alt="Logo Prefeitura" className="h-7 object-contain" />
                    ) : (
                      <span className="w-3 h-8 bg-indigo-600 rounded-full" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-2xl sm:text-3xl font-serif font-black text-slate-950 uppercase tracking-tight">
                          Reportagens & Acontecimentos Oficiais
                        </h3>
                        {!secoesVisibilidade.reportagensCalendario && isAdmin && (
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-black uppercase font-sans">
                            Seção Oculta
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-sans text-slate-500 font-semibold">
                        Acompanhe as ações, inaugurações, reuniões e eventos públicos publicados pela administração
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 font-sans">
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => toggleSecao('reportagensCalendario')}
                        className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border shadow-2xs ${
                          !secoesVisibilidade.reportagensCalendario
                            ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {!secoesVisibilidade.reportagensCalendario ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        <span>{!secoesVisibilidade.reportagensCalendario ? 'Reexibir Seção' : 'Ocultar Seção'}</span>
                      </button>
                    )}
                    <span className="hidden sm:inline-flex px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-black uppercase tracking-wider items-center gap-1.5 font-sans">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> Cobertura com Redação IA
                    </span>
                  </div>
                </div>

                {loading && materiasParaExibicao.length === 0 ? (
                  <NoticiasSkeletonGrid />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {materiasParaExibicao.map((mat) => (
                      <NewsCardItem
                        key={mat.id}
                        mat={mat}
                        isAdmin={isAdmin}
                        prefeituraLogoUrl={prefeituraLogoUrl}
                        onOpen={(m) => setMateriaAberta(m)}
                        onAprovar={handleAprovarMateria}
                        onDownload={handleDownloadImediato}
                        onToggleDestaque={handleToggleDestaqueMateria}
                        onToggleOcultar={handleToggleOcultarMateria}
                        onExcluir={handleExcluirMateria}
                        isDownloading={baixandoMateriaId === mat.id}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* ------------------------------------------------------------------- */}
            {/* GRID DE MATÉRIAS POR CADERNO JORNALÍSTICO */}
            {/* ------------------------------------------------------------------- */}
            {((secoesVisibilidade.farmacia || secoesVisibilidade.consultas || secoesVisibilidade.transporte) || isAdmin) && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-start">
                
                {/* ================================================================= */}
                {/* MATÉRIA 1: CADERNO DE SAÚDE & ASSISTÊNCIA FARMACÊUTICA */}
                {/* ================================================================= */}
                {(secoesVisibilidade.farmacia || isAdmin) && (
                  <article className={`bg-white rounded-3xl border shadow-md p-6 sm:p-8 flex flex-col justify-between h-full space-y-6 hover:shadow-xl transition-all relative ${
                    !secoesVisibilidade.farmacia ? 'border-amber-400 bg-amber-50/20' : 'border-slate-200/80'
                  }`}>
                    <div className="space-y-4">
                      
                      {/* Badge da Seção & Ações de Admin */}
                      <div className="flex items-center justify-between font-sans border-b border-slate-100 pb-3">
                        <span className="px-2.5 py-1 rounded bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                          <Pill className="w-3.5 h-3.5" /> Caderno de Saúde Pública
                        </span>

                        <div className="flex items-center gap-2">
                          {!secoesVisibilidade.farmacia && isAdmin && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-black uppercase flex items-center gap-1 shadow-sm">
                              <EyeOff className="w-3 h-3" /> Oculta
                            </span>
                          )}

                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => toggleSecao('farmacia')}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                !secoesVisibilidade.farmacia
                                  ? 'text-amber-700 bg-amber-100 hover:bg-amber-200'
                                  : 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                              }`}
                              title={!secoesVisibilidade.farmacia ? 'Reexibir matéria para o público' : 'Ocultar matéria do público'}
                            >
                              {!secoesVisibilidade.farmacia ? <Eye className="w-3.5 h-3.5 text-amber-700" /> : <EyeOff className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Título da Matéria */}
                      <h3 className="text-xl sm:text-2xl font-serif font-black tracking-tight text-slate-900 leading-snug">
                        Em {MESES[boletim.mes - 1] ? MESES[boletim.mes - 1].toUpperCase() : 'MÊS'} de {boletim.ano}, a Farmácia Popular atende {boletim.farmacia.totalPacientesAtendidos.toLocaleString('pt-BR')} munícipes e garante entrega contínua de medicamentos
                      </h3>

                      {/* Texto Editorial */}
                      <p className="text-sm font-serif text-slate-600 leading-relaxed">
                        A Assistência Farmacêutica Municipal totalizou <strong>{boletim.farmacia.totalMedicamentosDispensados.toLocaleString('pt-BR')} unidades</strong> de medicamentos gratuitos fornecidos à população de São José do Goiabal durante o período, distribuídos em <strong>{boletim.farmacia.totalAtendimentos} receitas atendidas</strong>.
                      </p>

                      {/* Citação Jornalística */}
                      <blockquote className="bg-rose-50/60 border-l-4 border-rose-500 p-3.5 rounded-r-xl text-xs italic font-serif text-rose-950 leading-relaxed">
                        <Quote className="w-3.5 h-3.5 text-rose-400 mb-1 inline mr-1" />
                        "O fornecimento pontual e gratuito de remédios básicos e contínuos assegura a saúde preventiva e o bem-estar das famílias de nossa cidade."
                      </blockquote>

                      {/* Top Medicamentos em Destaque */}
                      {boletim.farmacia.topMedicamentos.length > 0 && (
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 font-sans space-y-2.5">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                            💊 Itens Mais Dispensados no Período
                          </span>
                          <div className="space-y-1.5 text-xs font-bold text-slate-700">
                            {boletim.farmacia.topMedicamentos.slice(0, 3).map((med, idx) => (
                              <div key={idx} className="flex justify-between items-center py-1 border-b border-slate-200/60 last:border-0">
                                <span className="truncate pr-2">{idx + 1}. {med.nome}</span>
                                <span className="font-mono font-black text-rose-600 shrink-0">{med.quantidade} un</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-sans font-bold text-slate-500">
                      <span>Itens Ativos no Estoque: <strong className="text-slate-900">{boletim.farmacia.totalItensEstoqueAtivos}</strong></span>
                      <span className="text-rose-600 font-extrabold">Setor 01 • Saúde</span>
                    </div>
                  </article>
                )}

                {/* ================================================================= */}
                {/* MATÉRIA 2: CADERNO DE REGULAÇÃO, CONSULTAS & EXAMES */}
                {/* ================================================================= */}
                {(secoesVisibilidade.consultas || isAdmin) && (
                  <article className={`bg-white rounded-3xl border shadow-md p-6 sm:p-8 flex flex-col justify-between h-full space-y-6 hover:shadow-xl transition-all relative ${
                    !secoesVisibilidade.consultas ? 'border-amber-400 bg-amber-50/20' : 'border-slate-200/80'
                  }`}>
                    <div className="space-y-4">
                      
                      {/* Badge da Seção & Ações de Admin */}
                      <div className="flex items-center justify-between font-sans border-b border-slate-100 pb-3">
                        <span className="px-2.5 py-1 rounded bg-sky-50 border border-sky-200 text-sky-700 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5" /> Caderno de Regulação
                        </span>

                        <div className="flex items-center gap-2">
                          {!secoesVisibilidade.consultas && isAdmin && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-black uppercase flex items-center gap-1 shadow-sm">
                              <EyeOff className="w-3 h-3" /> Oculta
                            </span>
                          )}

                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => toggleSecao('consultas')}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                !secoesVisibilidade.consultas
                                  ? 'text-amber-700 bg-amber-100 hover:bg-amber-200'
                                  : 'text-slate-400 hover:text-sky-600 hover:bg-sky-50'
                              }`}
                              title={!secoesVisibilidade.consultas ? 'Reexibir matéria para o público' : 'Ocultar matéria do público'}
                            >
                              {!secoesVisibilidade.consultas ? <Eye className="w-3.5 h-3.5 text-amber-700" /> : <EyeOff className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Título da Matéria */}
                      <h3 className="text-xl sm:text-2xl font-serif font-black tracking-tight text-slate-900 leading-snug">
                        Em {MESES[boletim.mes - 1] ? MESES[boletim.mes - 1].toUpperCase() : 'MÊS'} de {boletim.ano}, a Regulação Médica viabiliza {boletim.consultas.totalAgendamentos.toLocaleString('pt-BR')} atendimentos especializados
                      </h3>

                      {/* Texto Editorial */}
                      <p className="text-sm font-serif text-slate-600 leading-relaxed">
                        Com foco na redução de filas e acolhimento humanizado, a Central Municipal de Regulação assegurou <strong>{boletim.consultas.totalAgendamentos} agendamentos</strong> para <strong>{boletim.consultas.totalPacientesAtendidos} pacientes</strong>.
                      </p>

                      {/* Citação Jornalística */}
                      <blockquote className="bg-sky-50/60 border-l-4 border-sky-500 p-3.5 rounded-r-xl text-xs italic font-serif text-sky-950 leading-relaxed">
                        <Quote className="w-3.5 h-3.5 text-sky-400 mb-1 inline mr-1" />
                        "Garantir acesso rápido aos médicos especialistas e exames complexos é o compromisso inegociável da regulação de saúde."
                      </blockquote>

                      {/* Top Procedimentos */}
                      {boletim.consultas.topProcedimentos.length > 0 && (
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 font-sans space-y-2.5">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                            🩺 Especialidades & Exames Mais Procurados
                          </span>
                          <div className="space-y-1.5 text-xs font-bold text-slate-700">
                            {boletim.consultas.topProcedimentos.slice(0, 3).map((proc, idx) => (
                              <div key={idx} className="flex justify-between items-center py-1 border-b border-slate-200/60 last:border-0">
                                <span className="truncate pr-2">{idx + 1}. {proc.nome}</span>
                                <span className="font-mono font-black text-sky-600 shrink-0">{proc.quantidade} vagas</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-sans font-bold text-slate-500">
                      <span>Pacientes Beneficiados: <strong className="text-slate-900">{boletim.consultas.totalPacientesAtendidos}</strong></span>
                      <span className="text-sky-600 font-extrabold">Setor 02 • Regulação</span>
                    </div>
                  </article>
                )}

                {/* ================================================================= */}
                {/* MATÉRIA 3: CADERNO DE TRANSPORTE, FROTAS & LOGÍSTICA */}
                {/* ================================================================= */}
                {(secoesVisibilidade.transporte || isAdmin) && (
                  <article className={`bg-white rounded-3xl border shadow-md p-6 sm:p-8 flex flex-col justify-between h-full space-y-6 hover:shadow-xl transition-all relative ${
                    !secoesVisibilidade.transporte ? 'border-amber-400 bg-amber-50/20' : 'border-slate-200/80'
                  }`}>
                    <div className="space-y-4">
                      
                      {/* Badge da Seção & Ações de Admin */}
                      <div className="flex items-center justify-between font-sans border-b border-slate-100 pb-3">
                        <span className="px-2.5 py-1 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5">
                          <Car className="w-3.5 h-3.5" /> Caderno de Transportes
                        </span>

                        <div className="flex items-center gap-2">
                          {!secoesVisibilidade.transporte && isAdmin && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-black uppercase flex items-center gap-1 shadow-sm">
                              <EyeOff className="w-3 h-3" /> Oculta
                            </span>
                          )}

                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => toggleSecao('transporte')}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                !secoesVisibilidade.transporte
                                  ? 'text-amber-700 bg-amber-100 hover:bg-amber-200'
                                  : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
                              }`}
                              title={!secoesVisibilidade.transporte ? 'Reexibir matéria para o público' : 'Ocultar matéria do público'}
                            >
                              {!secoesVisibilidade.transporte ? <Eye className="w-3.5 h-3.5 text-amber-700" /> : <EyeOff className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Título da Matéria */}
                      <h3 className="text-xl sm:text-2xl font-serif font-black tracking-tight text-slate-900 leading-snug">
                        Em {MESES[boletim.mes - 1] ? MESES[boletim.mes - 1].toUpperCase() : 'MÊS'} de {boletim.ano}, a Frota Municipal transporta {boletim.veiculos.totalPassageiros.toLocaleString('pt-BR')} cidadãos em {boletim.veiculos.totalViagensRealizadas} viagens
                      </h3>

                      {/* Texto Editorial */}
                      <p className="text-sm font-serif text-slate-600 leading-relaxed">
                        A logística municipal de transporte garantiu deslocamento com conforto e segurança para tratamentos fora do domicílio (TFD), viagens de interesse público e apoio às secretarias.
                      </p>

                      {/* Citação Jornalística */}
                      <blockquote className="bg-indigo-50/60 border-l-4 border-indigo-500 p-3.5 rounded-r-xl text-xs italic font-serif text-indigo-950 leading-relaxed">
                        <Quote className="w-3.5 h-3.5 text-indigo-400 mb-1 inline mr-1" />
                        "Transportar com pontualidade e dignidade nossos pacientes para hospitais de referência salva vidas e tranquiliza as famílias."
                      </blockquote>

                      {/* Top Destinos */}
                      {boletim.veiculos.topDestinos.length > 0 && (
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 font-sans space-y-2.5">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 block">
                            📍 Principais Destinos Atendidos
                          </span>
                          <div className="space-y-1.5 text-xs font-bold text-slate-700">
                            {boletim.veiculos.topDestinos.slice(0, 3).map((dest, idx) => (
                              <div key={idx} className="flex justify-between items-center py-1 border-b border-slate-200/60 last:border-0">
                                <span className="truncate pr-2">{idx + 1}. {dest.destino}</span>
                                <span className="font-mono font-black text-indigo-600 shrink-0">{dest.viagens} viagens</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>

                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-sans font-bold text-slate-500">
                      <span>Frota Operacional: <strong className="text-slate-900">{boletim.veiculos.veiculosFrotaAtivos} veículos</strong></span>
                      <span className="text-indigo-600 font-extrabold">Setor 03 • Frotas</span>
                    </div>
                  </article>
                )}

              </div>
            )}

            {/* ------------------------------------------------------------------- */}
            {/* BOX EDITORIAL INSTITUCIONAL & FRASE OBRIGATÓRIA */}
            {/* ------------------------------------------------------------------- */}
            {(secoesVisibilidade.balancoGeral || isAdmin) && (
              <div className={`bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-8 sm:p-12 text-white shadow-xl flex flex-col md:flex-row items-center justify-between gap-8 font-sans relative ${
                !secoesVisibilidade.balancoGeral ? 'ring-4 ring-amber-400 opacity-90' : ''
              }`}>
                {isAdmin && (
                  <div className="absolute top-4 right-4 flex items-center gap-2">
                    {!secoesVisibilidade.balancoGeral && (
                      <span className="px-2.5 py-1 rounded-full bg-amber-500 text-white text-[10px] font-black uppercase flex items-center gap-1 shadow-sm">
                        <EyeOff className="w-3.5 h-3.5" /> Oculto do Público
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleSecao('balancoGeral')}
                      className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer text-xs flex items-center gap-1"
                      title={!secoesVisibilidade.balancoGeral ? 'Reexibir box institucional' : 'Ocultar box institucional'}
                    >
                      {!secoesVisibilidade.balancoGeral ? <Eye className="w-4 h-4 text-amber-300" /> : <EyeOff className="w-4 h-4 text-slate-300" />}
                    </button>
                  </div>
                )}

                <div className="space-y-3 text-center md:text-left">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-indigo-300 text-xs font-black uppercase tracking-wider">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Transparência Pública Garantida</span>
                  </div>
                  <h4 className="text-xl sm:text-3xl font-serif font-black tracking-tight leading-snug">
                    📊 "Resultados que demonstram o trabalho e os serviços realizados em nosso município."
                  </h4>
                  <p className="text-xs text-slate-300 font-medium max-w-2xl">
                    Todos os dados publicados nesta edição são extraídos e auditados em tempo real diretamente dos sistemas de gestão da Prefeitura Municipal de São José do Goiabal.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
                  <button
                    onClick={() => setIsStoryModalOpen(true)}
                    className="px-6 py-3.5 bg-white text-slate-900 hover:bg-slate-100 rounded-2xl text-xs font-black transition-all flex items-center gap-2 shadow-lg active:scale-95 cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-indigo-600" />
                    <span>Baixar Edição para Redes</span>
                  </button>
                </div>
              </div>
            )}

          </div>
        ) : (
          <div className="py-24 text-center space-y-4 font-sans">
            <p className="text-slate-500 font-bold">Nenhum dado encontrado para o período selecionado.</p>
          </div>
        )}

      </main>

      {/* ========================================================================= */}
      {/* 3. MODAL DE LEITURA COMPLETA DA MATÉRIA PUBLICADA COM LOGO OFICIAL */}
      {/* ========================================================================= */}
      {materiaAberta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in font-serif">
          <div className="bg-white rounded-[2.5rem] p-6 sm:p-10 max-w-3xl w-full space-y-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto custom-scrollbar my-auto">
            
            {/* Topo do Leitor com Logo da Prefeitura e Categoria */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 font-sans">
              <div className="flex items-center gap-3">
                {prefeituraLogoUrl ? (
                  <img src={prefeituraLogoUrl} alt="Logo Prefeitura" className="h-8 object-contain" />
                ) : (
                  <div className="w-8 h-8 rounded-xl bg-indigo-900 text-white flex items-center justify-center text-xs font-bold">
                    🏛️
                  </div>
                )}

                <div>
                  <span className="px-2.5 py-0.5 rounded bg-indigo-100 text-indigo-900 text-[10px] font-black uppercase tracking-wider">
                    {materiaAberta.categoria || 'ADMINISTRAÇÃO MUNICIPAL'}
                  </span>
                  <p className="text-[10px] text-slate-400 font-bold mt-0.5">Prefeitura Municipal de São José do Goiabal</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Botão de Aprovação e Publicação no Modal (Exclusivo Administrador) */}
                {isAdmin && materiaAberta.aprovada === false && (
                  <button
                    type="button"
                    onClick={(e) => handleAprovarMateria(materiaAberta.id, e)}
                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black shadow-md flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                    title="Aprovar e Publicar matéria no Jornal Oficial (Ficará visível para todos)"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Aprovar & Publicar</span>
                  </button>
                )}

                {/* Botão Baixar Imagem Story 1080x1920 (Apenas Ícone) */}
                <button
                  type="button"
                  onClick={(e) => handleDownloadImediato(materiaAberta, e)}
                  disabled={baixandoMateriaId === materiaAberta.id}
                  className="p-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-900 transition-all flex items-center justify-center border border-indigo-100 cursor-pointer shadow-2xs active:scale-95 disabled:opacity-60"
                  title="Baixar matéria em formato de jornal (PNG 1080x1920)"
                >
                  {baixandoMateriaId === materiaAberta.id ? (
                    <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4 text-indigo-600" />
                  )}
                </button>

                {isAdmin && (
                  <button
                    type="button"
                    onClick={(e) => handleToggleDestaqueMateria(materiaAberta.id, e)}
                    className={`p-2 rounded-xl transition-all flex items-center justify-center border cursor-pointer active:scale-95 shadow-2xs ${
                      materiaAberta.destaque
                        ? 'text-amber-950 bg-gradient-to-r from-amber-200 to-yellow-300 border-amber-400 hover:from-amber-300 hover:to-yellow-400 shadow-sm'
                        : 'text-slate-500 bg-white border-slate-200 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200'
                    }`}
                    title={materiaAberta.destaque ? 'Remover dos destaques principais' : 'Definir como destaque principal'}
                  >
                    <Star className={`w-4 h-4 ${materiaAberta.destaque ? 'fill-amber-900 text-amber-900' : 'text-slate-500'}`} />
                  </button>
                )}

                {materiaAberta.aprovada === false && (
                  <span className="px-2.5 py-1 rounded-full bg-rose-100 text-rose-800 text-[10px] font-black uppercase flex items-center gap-1 animate-pulse">
                    <Clock className="w-3.5 h-3.5 text-rose-600" /> Pendente de Aprovação
                  </span>
                )}

                {materiaAberta.oculta && (
                  <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black uppercase flex items-center gap-1">
                    <EyeOff className="w-3.5 h-3.5" /> Matéria Oculta
                  </span>
                )}
                <button
                  onClick={() => setMateriaAberta(null)}
                  className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Imagem em Destaque com Logo no Canto */}
            {materiaAberta.imagemUrl && (
              <div className="w-full h-64 sm:h-80 rounded-3xl overflow-hidden shadow-lg bg-slate-100 relative shrink-0">
                <img
                  src={materiaAberta.imagemUrl}
                  alt={materiaAberta.titulo}
                  loading="eager"
                  decoding="async"
                  className="w-full h-full object-cover"
                />
                {prefeituraLogoUrl && (
                  <div className="absolute bottom-3 right-3 p-1.5 rounded-xl bg-white/90 backdrop-blur-sm shadow-md pointer-events-none">
                    <img
                      src={prefeituraLogoUrl}
                      alt="Logo"
                      loading="eager"
                      decoding="async"
                      className="h-5 max-w-[80px] object-contain"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Manchete */}
            <h2 className="text-2xl sm:text-4xl font-serif font-black text-slate-950 leading-tight">
              {materiaAberta.titulo}
            </h2>

            {/* Subtítulo / Lead */}
            <p className="text-base sm:text-lg font-serif text-slate-700 italic border-l-4 border-indigo-600 pl-4 py-1 leading-relaxed">
              "{materiaAberta.subtitulo}"
            </p>

            {/* Metadados */}
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-sans text-slate-400 font-bold border-y border-slate-100 py-3">
              <span>Por <strong>{materiaAberta.autor}</strong></span>
              <span>Publicado em: {new Date(materiaAberta.dataPublicacao).toLocaleDateString('pt-BR')}</span>
              {materiaAberta.horaEvento && <span>Horário: {materiaAberta.horaEvento}</span>}
            </div>

            {/* Corpo Completo */}
            <div className="text-base font-serif text-slate-800 leading-relaxed space-y-4 whitespace-pre-line">
              {materiaAberta.conteudo}
            </div>

            {/* Citação em Destaque */}
            {materiaAberta.destaqueFrase && (
              <blockquote className="p-5 bg-gradient-to-r from-indigo-50 to-sky-50 border-l-4 border-indigo-600 rounded-r-2xl text-sm font-serif italic text-indigo-950 leading-relaxed">
                "{materiaAberta.destaqueFrase}"
              </blockquote>
            )}

            <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 font-sans">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir</span>
                </button>

                {/* Botão Baixar em Formato de Story Vertical PNG 1080x1920 */}
                <button
                  onClick={() => setMateriaParaExportarPng(materiaAberta)}
                  className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-900 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-xs border border-indigo-200"
                >
                  <Download className="w-4 h-4 text-indigo-600" />
                  <span>Baixar Story (PNG 1080x1920)</span>
                </button>

                {/* Botão Ocultar / Reexibir Publicação para Administrador */}
                {isAdmin && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleOcultarMateria(materiaAberta.id, e);
                      setMateriaAberta(prev => prev ? { ...prev, oculta: !prev.oculta } : null);
                    }}
                    className={`px-4 py-2.5 rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-xs border ${
                      materiaAberta.oculta
                        ? 'bg-amber-100 text-amber-900 border-amber-300 hover:bg-amber-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 hover:text-amber-800'
                    }`}
                  >
                    {materiaAberta.oculta ? <EyeOff className="w-4 h-4 text-amber-700" /> : <Eye className="w-4 h-4 text-slate-600" />}
                    <span>{materiaAberta.oculta ? 'Reexibir para o Público' : 'Ocultar Publicação'}</span>
                  </button>
                )}
              </div>

              <button
                onClick={() => setMateriaAberta(null)}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black text-xs cursor-pointer shadow active:scale-95"
              >
                Fechar Leitura
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MODAL EXPORTADOR DE MATÉRIA EM FORMATO DE JORNAL PNG (1920x1080) */}
      {/* ========================================================================= */}
      {materiaParaExportarPng && (
        <MateriaJornalPngModal
          materia={materiaParaExportarPng}
          isOpen={!!materiaParaExportarPng}
          onClose={() => setMateriaParaExportarPng(null)}
          logoUrl={prefeituraLogoUrl}
          onNotify={showNotification}
        />
      )}

      {/* ========================================================================= */}
      {/* 5. MODAL GERADOR E EXPORTADOR DE STORIES (1080x1920) */}
      {/* ========================================================================= */}
      {boletim && (
        <BoletimStoryGenerator
          boletim={boletim}
          isOpen={isStoryModalOpen}
          onClose={() => setIsStoryModalOpen(false)}
          onNotify={showNotification}
          logoUrl={prefeituraLogoUrl}
        />
      )}

      {/* ========================================================================= */}
      {/* 6. MODAL ADMINISTRATIVO DE GERENCIAMENTO DE VISIBILIDADE DO JORNAL */}
      {/* ========================================================================= */}
      {isGerenciarVisibilidadeOpen && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in font-sans">
          <div className="bg-white rounded-[2.5rem] p-6 sm:p-8 max-w-lg w-full space-y-6 shadow-2xl border border-slate-200">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center font-bold">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-950">Visibilidade das Matérias</h3>
                  <p className="text-xs text-slate-500">Defina quais seções e matérias automáticas ficam visíveis ao público.</p>
                </div>
              </div>

              <button
                onClick={() => setIsGerenciarVisibilidadeOpen(false)}
                className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {[
                { key: 'manchete' as const, label: 'Manchete Principal da Edição', desc: 'Balanço geral consolidado no topo do jornal', icon: Newspaper },
                { key: 'reportagensCalendario' as const, label: 'Reportagens do Calendário & IA', desc: 'Acontecimentos, reuniões e eventos publicados', icon: Calendar },
                { key: 'farmacia' as const, label: 'Caderno de Saúde / Farmácia Popular', desc: 'Dispensação de remédios e atendimentos farmacêuticos', icon: Pill },
                { key: 'consultas' as const, label: 'Caderno de Regulação / Consultas & Exames', desc: 'Agendamentos e especialidades médicas', icon: Activity },
                { key: 'transporte' as const, label: 'Caderno de Transporte & Frotas', desc: 'Viagens municipais, passageiros e destinos', icon: Car },
                { key: 'balancoGeral' as const, label: 'Box Institucional de Transparência', desc: 'Mensagem de compromisso e certificação', icon: ShieldCheck }
              ].map((sec) => {
                const Icon = sec.icon;
                const isVisible = secoesVisibilidade[sec.key];
                return (
                  <div
                    key={sec.key}
                    onClick={() => toggleSecao(sec.key)}
                    className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 cursor-pointer select-none ${
                      isVisible
                        ? 'bg-slate-50 border-slate-200/90 hover:bg-slate-100'
                        : 'bg-amber-50/50 border-amber-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isVisible ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-800'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black text-slate-900">{sec.label}</h4>
                        <p className="text-[11px] text-slate-500 font-medium">{sec.desc}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase flex items-center gap-1 ${
                        isVisible ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {isVisible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        <span>{isVisible ? 'Visível' : 'Oculto'}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end">
              <button
                onClick={() => setIsGerenciarVisibilidadeOpen(false)}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black text-xs cursor-pointer shadow active:scale-95"
              >
                Concluir Configuração
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Container invisível off-screen para download direto da matéria em PNG (1080x1920) */}
      {materiaParaDownloadDireto && (
        <div
          style={{
            position: 'fixed',
            left: '-20000px',
            top: '0',
            width: '1080px',
            height: '1920px',
            overflow: 'hidden',
            zIndex: -9999
          }}
        >
          <div ref={directDownloadRef} style={{ width: '1080px', height: '1920px' }}>
            <StoryMateriaJornalTemplate
              materia={materiaParaDownloadDireto}
            />
          </div>
        </div>
      )}

    </div>
  );
};
