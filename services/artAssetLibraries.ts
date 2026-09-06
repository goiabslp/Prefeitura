/**
 * =========================================================================
 * BIBLIOTECAS VISUAIS GRATUITAS & ASSETS VETORIAIS — MÓDULO ART
 * =========================================================================
 * Integração e catálogo de recursos visuais gratuitos com licenças de uso
 * comercial e institucional livres (MIT, ISC, SIL OFL, CC0/Public Domain).
 *
 * Fontes suportadas:
 * - Lucide Icons, Phosphor Icons, Heroicons, Tabler Icons
 * - Google Fonts (Montserrat, Bebas Neue, Outfit, Poppins, Inter)
 * - Haikei (Ondas SVG, Blobs, Formas Orgânicas e Retículas Halftone)
 * - OpenMoji & unDraw / Storyset (Elementos ilustrativos vetoriais)
 */

export interface VisualAssetLibrary {
  id: string;
  name: string;
  category: 'icons' | 'fonts' | 'shapes' | 'illustrations';
  description: string;
  license: string;
  licenseType: 'MIT' | 'ISC' | 'OFL' | 'CC0' | 'FreeCommercial';
  isAvailableOffline: boolean;
  recommendedUse: string;
}

export const VISUAL_ASSET_LIBRARIES: VisualAssetLibrary[] = [
  {
    id: 'lucide',
    name: 'Lucide Icons',
    category: 'icons',
    description: 'Mais de 1.000 ícones modernos, geométricos, ultra legíveis e otimizados para sinalização institucional.',
    license: 'ISC / MIT — Livre para projetos comerciais, governamentais e públicos.',
    licenseType: 'MIT',
    isAvailableOffline: true,
    recommendedUse: 'Pins de localização, relógios, calendários, setas de ação e badges de status.'
  },
  {
    id: 'phosphor',
    name: 'Phosphor Icons',
    category: 'icons',
    description: 'Família flexível de ícones com múltiplos pesos (thin, regular, bold, fill) para composição publicitária.',
    license: 'MIT — Livre para qualquer finalidade institucional.',
    licenseType: 'MIT',
    isAvailableOffline: true,
    recommendedUse: 'Símbolos de esporte, cultura e utilidade pública em alto contraste.'
  },
  {
    id: 'heroicons',
    name: 'Heroicons',
    category: 'icons',
    description: 'Conjunto premium de ícones desenhados em vetor 24px com alta legibilidade em pequenas e grandes escalas.',
    license: 'MIT — Código aberto e livre.',
    licenseType: 'MIT',
    isAvailableOffline: true,
    recommendedUse: 'Selo oficial de checagem, segurança cívica e chamadas para ação.'
  },
  {
    id: 'tabler',
    name: 'Tabler Icons',
    category: 'icons',
    description: 'Mais de 5.000 ícones vetoriais consistentes em grid de 24x24 pixels.',
    license: 'MIT — Livre irrestrito.',
    licenseType: 'MIT',
    isAvailableOffline: true,
    recommendedUse: 'Infraestrutura, transportes, obras, meio ambiente e dados estatísticos.'
  },
  {
    id: 'google_fonts',
    name: 'Google Fonts',
    category: 'fonts',
    description: 'Catálogo de tipografias de alto impacto para manchetes e leitura rápida em feeds sociais.',
    license: 'SIL Open Font License 1.1 / Apache 2.0 — Uso livre em mídia digital e impressa.',
    licenseType: 'OFL',
    isAvailableOffline: true,
    recommendedUse: 'Títulos em Montserrat Black, Bebas Neue, Gotham Style e Gotham Ultra.'
  },
  {
    id: 'haikei',
    name: 'Haikei Shape Engine',
    category: 'shapes',
    description: 'Gerador vetorial de formas fluidas, ondas de base, retículas pontilhadas e blobs orgânicos.',
    license: 'CC0 / Domínio Público para todos os caminhos e SVGs gerados.',
    licenseType: 'CC0',
    isAvailableOffline: true,
    recommendedUse: 'Bases de rodapé, cantos superiores iluminados e transição suave sobre a fotografia.'
  },
  {
    id: 'openmoji',
    name: 'OpenMoji Library',
    category: 'illustrations',
    description: 'Elementos visuais ilustrativos e símbolos em estilo flat com contorno limpo.',
    license: 'CC BY-SA 4.0 — Uso em comunicação social e governamental.',
    licenseType: 'FreeCommercial',
    isAvailableOffline: true,
    recommendedUse: 'Stickers de confirmação (✅, ⚡, 📢, 📍, 🏆) e apoio temático.'
  },
  {
    id: 'undraw_storyset',
    name: 'unDraw & Storyset Vector Assets',
    category: 'illustrations',
    description: 'Ilustrações de pessoas, cidadania e serviços municipais em SVG adaptável.',
    license: 'unDraw License / Freepik Storyset — Livre para uso institucional sem custo.',
    licenseType: 'FreeCommercial',
    isAvailableOffline: true,
    recommendedUse: 'Artes de vacinação, matrícula escolar, meio ambiente e assistência social.'
  }
];

// =========================================================================
// CAMINHOS VETORIAIS SVG (ESTILO HAIKEI & FORMULÁRIOS DINÂMICOS)
// =========================================================================

/**
 * Retorna caminho SVG de onda fluida Haikei para apoio no rodapé da arte
 */
export const getHaikeiWaveSvgPath = (variant: 1 | 2 | 3 = 1): string => {
  switch (variant) {
    case 1:
      return 'M0,160 C320,240 760,80 1080,180 L1080,300 L0,300 Z';
    case 2:
      return 'M0,120 C240,60 840,200 1080,100 L1080,300 L0,300 Z';
    case 3:
    default:
      return 'M0,180 C400,100 680,260 1080,140 L1080,300 L0,300 Z';
  }
};

/**
 * Retorna caminho SVG de blob orgânico Haikei para pontos de luz e profundidade
 */
export const getHaikeiBlobSvgPath = (variant: 1 | 2 = 1): string => {
  if (variant === 1) {
    return 'M420,120 C520,180 560,340 480,440 C400,540 220,560 140,480 C60,400 60,220 160,140 C260,60 320,60 420,120 Z';
  }
  return 'M380,80 C490,140 540,280 490,390 C440,500 300,520 190,460 C80,400 40,260 90,150 C140,40 270,20 380,80 Z';
};

/**
 * Geração de Padrão Reticulado Halftone em SVG para texturas profissionais
 */
export const getHalftoneDotsPatternSvg = (dotColor: string = 'rgba(255,255,255,0.18)'): string => {
  return `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
    <circle cx="3" cy="3" r="1.5" fill="${dotColor}" />
    <circle cx="15" cy="3" r="1.2" fill="${dotColor}" />
    <circle cx="9" cy="15" r="1.5" fill="${dotColor}" />
    <circle cx="21" cy="15" r="1.2" fill="${dotColor}" />
  </svg>`;
};

// =========================================================================
// RECOMENDAÇÃO INTELIGENTE DE ELEMENTOS POR TEMÁTICA MUNICIPAL
// =========================================================================

export interface ThemeAssetRecommendation {
  themeName: string;
  palette: {
    primary: string;
    secondaryContrast: string;
    neutralHighlight: string;
    darkSupport: string;
  };
  primaryIcons: string[]; // Nomes de ícones Lucide/Heroicons
  badgeType: 'verified' | 'alert' | 'calendar' | 'official' | 'event';
  badgeLabel: string;
  fontFamilyTitle: string;
  haikeiShape: 'wave' | 'blob' | 'halftone' | 'minimal';
}

/**
 * Analisa contexto temático e seleciona a melhor combinação de elementos das bibliotecas
 */
export const getRecommendedAssetsForContext = (
  category: string = '',
  title: string = '',
  description: string = ''
): ThemeAssetRecommendation => {
  const text = `${category} ${title} ${description}`.toLowerCase();

  // 1. Saúde Pública / Vacinação / Prevenção
  if (text.includes('saúde') || text.includes('vacin') || text.includes('ubs') || text.includes('hospital') || text.includes('remédio') || text.includes('médic')) {
    return {
      themeName: 'Saúde Pública & Cidadania',
      palette: {
        primary: '#1d4ed8', // Azul Royal Cívico
        secondaryContrast: '#facc15', // Amarelo Ouro
        neutralHighlight: '#ffffff', // Branco Puro
        darkSupport: '#0f172a' // Azul Escuro Chumbo
      },
      primaryIcons: ['HeartPulse', 'ShieldCheck', 'Calendar', 'MapPin', 'CheckCircle2'],
      badgeType: 'verified',
      badgeLabel: '✅ GRATUITO COM CARTÃO SUS',
      fontFamilyTitle: 'Montserrat, sans-serif',
      haikeiShape: 'wave'
    };
  }

  // 2. Esporte, Competição e Lazer
  if (text.includes('esporte') || text.includes('futebol') || text.includes('campeonato') || text.includes('corrida') || text.includes('torneio') || text.includes('ginásio')) {
    return {
      themeName: 'Esporte & Competição',
      palette: {
        primary: '#15803d', // Verde Bandeira
        secondaryContrast: '#84cc16', // Verde Limão Neon
        neutralHighlight: '#ffffff',
        darkSupport: '#09090b' // Preto Absoluto
      },
      primaryIcons: ['Trophy', 'Zap', 'Flame', 'Calendar', 'MapPin'],
      badgeType: 'event',
      badgeLabel: '⚡ GRANDE FINAL',
      fontFamilyTitle: 'Bebas Neue, Impact, sans-serif',
      haikeiShape: 'halftone'
    };
  }

  // 3. Obras, Infraestrutura e Mobilidade
  if (text.includes('obra') || text.includes('asfalto') || text.includes('paviment') || text.includes('constru') || text.includes('reforma') || text.includes('trânsito')) {
    return {
      themeName: 'Obras & Progresso',
      palette: {
        primary: '#ea580c', // Laranja Asfalto
        secondaryContrast: '#fde047', // Amarelo Trânsito
        neutralHighlight: '#ffffff',
        darkSupport: '#18181b' // Grafite Pesado
      },
      primaryIcons: ['HardHat', 'Truck', 'Wrench', 'MapPin', 'CheckCircle2'],
      badgeType: 'official',
      badgeLabel: '🚧 MAIS MOBILIDADE E SEGURANÇA',
      fontFamilyTitle: 'Montserrat, sans-serif',
      haikeiShape: 'halftone'
    };
  }

  // 4. Cultura, Festas e Celebrações
  if (text.includes('cultura') || text.includes('show') || text.includes('festa') || text.includes('música') || text.includes('teatro') || text.includes('carnaval') || text.includes('festival')) {
    return {
      themeName: 'Cultura & Grandes Eventos',
      palette: {
        primary: '#7c3aed', // Roxo Festivo
        secondaryContrast: '#f43f5e', // Rosa Pink Vibrante
        neutralHighlight: '#ffffff',
        darkSupport: '#0f172a'
      },
      primaryIcons: ['Sparkles', 'Music', 'PartyPopper', 'Calendar', 'MapPin'],
      badgeType: 'event',
      badgeLabel: '🎉 ENTRADA FRANCA',
      fontFamilyTitle: 'Outfit, Montserrat, sans-serif',
      haikeiShape: 'blob'
    };
  }

  // 5. Educação e Juventude
  if (text.includes('educa') || text.includes('escola') || text.includes('aluno') || text.includes('professor') || text.includes('matrícula') || text.includes('creche')) {
    return {
      themeName: 'Educação & Ensino',
      palette: {
        primary: '#0284c7', // Azul Céu Educativo
        secondaryContrast: '#fbbf24', // Amarelo Inspiração
        neutralHighlight: '#ffffff',
        darkSupport: '#0f172a'
      },
      primaryIcons: ['GraduationCap', 'BookOpen', 'Lightbulb', 'Calendar', 'MapPin'],
      badgeType: 'official',
      badgeLabel: '📚 MATRÍCULAS ABERTAS',
      fontFamilyTitle: 'Montserrat, sans-serif',
      haikeiShape: 'wave'
    };
  }

  // Padrão Geral Institucional
  return {
    themeName: 'Comunicação Oficial',
    palette: {
      primary: '#1e40af', // Azul Institucional
      secondaryContrast: '#f59e0b', // Âmbar Dourado
      neutralHighlight: '#ffffff',
      darkSupport: '#0f172a'
    },
    primaryIcons: ['Shield', 'Megaphone', 'Calendar', 'MapPin', 'CheckCircle2'],
    badgeType: 'official',
    badgeLabel: '🏛️ COMUNICAÇÃO OFICIAL',
    fontFamilyTitle: 'Montserrat, sans-serif',
    haikeiShape: 'wave'
  };
};
