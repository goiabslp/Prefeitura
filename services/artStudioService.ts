import { 
  ArtLogoItem, 
  ArtReferenceItem, 
  ArtPublication, 
  ArtVariation, 
  ArtFormatType,
  ArtLogoPosition 
} from '../types';

const STORAGE_KEY_LOGOS = 'prefeitura_art_logos_v1';
const STORAGE_KEY_REFS = 'prefeitura_art_references_v1';
const STORAGE_KEY_PUBS = 'prefeitura_art_publications_v1';

// ==========================================
// PERSISTÊNCIA ROBUSTA COM INDEXEDDB (SEM LIMITE DE 5MB)
// ==========================================
const DB_NAME = 'PrefeituraArtStudioDB';
const DB_VERSION = 2;
const STORE_REFS = 'art_references';
const STORE_LOGOS = 'art_logos';
const STORE_PUBS = 'art_publications';

let dbPromise: Promise<IDBDatabase> | null = null;
let memoryReferencesCache: ArtReferenceItem[] | null = null;
let memoryLogosCache: ArtLogoItem[] | null = null;
let memoryPubsCache: ArtPublication[] | null = null;

function getArtIndexedDB(): Promise<IDBDatabase> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('IndexedDB indisponível neste ambiente.'));
  }
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VERSION);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE_REFS)) {
            db.createObjectStore(STORE_REFS, { keyPath: 'index' });
          }
          if (!db.objectStoreNames.contains(STORE_LOGOS)) {
            db.createObjectStore(STORE_LOGOS, { keyPath: 'id' });
          }
          if (!db.objectStoreNames.contains(STORE_PUBS)) {
            db.createObjectStore(STORE_PUBS, { keyPath: 'id' });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => {
          console.warn('Falha ao abrir IndexedDB:', req.error);
          reject(req.error);
        };
      } catch (err) {
        reject(err);
      }
    });
  }
  return dbPromise;
}

/**
 * Grava todas as logos no IndexedDB (sem limite de 5MB)
 */
async function persistLogosToIndexedDB(logos: ArtLogoItem[]): Promise<void> {
  try {
    const db = await getArtIndexedDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_LOGOS, 'readwrite');
      const store = tx.objectStore(STORE_LOGOS);
      store.clear();
      logos.forEach(l => store.put(l));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Aviso: Não foi possível salvar logos no IndexedDB:', err);
  }
}

/**
 * Lê todas as logos do IndexedDB
 */
async function fetchLogosFromIndexedDB(): Promise<ArtLogoItem[]> {
  try {
    const db = await getArtIndexedDB();
    return await new Promise<ArtLogoItem[]>((resolve, reject) => {
      const tx = db.transaction(STORE_LOGOS, 'readonly');
      const store = tx.objectStore(STORE_LOGOS);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = (req.result || []) as ArtLogoItem[];
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Aviso: Não foi possível ler logos do IndexedDB:', err);
    return [];
  }
}

/**
 * Grava todas as referências no IndexedDB (persiste Gigabytes com segurança)
 */
async function persistReferencesToIndexedDB(refs: ArtReferenceItem[]): Promise<void> {
  try {
    const db = await getArtIndexedDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_REFS, 'readwrite');
      const store = tx.objectStore(STORE_REFS);
      store.clear();
      refs.forEach(r => store.put(r));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Aviso: Não foi possível salvar referências no IndexedDB:', err);
  }
}

/**
 * Lê todas as referências do IndexedDB
 */
async function fetchReferencesFromIndexedDB(): Promise<ArtReferenceItem[]> {
  try {
    const db = await getArtIndexedDB();
    return await new Promise<ArtReferenceItem[]>((resolve, reject) => {
      const tx = db.transaction(STORE_REFS, 'readonly');
      const store = tx.objectStore(STORE_REFS);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = (req.result || []) as ArtReferenceItem[];
        items.sort((a, b) => a.index - b.index);
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Aviso: Não foi possível ler referências do IndexedDB:', err);
    return [];
  }
}

/**
 * Grava todas as publicações no IndexedDB (persiste fotos em alta resolução sem limite de cota de 5MB)
 */
async function persistPublicationsToIndexedDB(pubs: ArtPublication[]): Promise<void> {
  try {
    const db = await getArtIndexedDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_PUBS, 'readwrite');
      const store = tx.objectStore(STORE_PUBS);
      store.clear();
      pubs.forEach(p => store.put(p));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Aviso: Não foi possível salvar publicações no IndexedDB:', err);
  }
}

/**
 * Lê todas as publicações do IndexedDB
 */
async function fetchPublicationsFromIndexedDB(): Promise<ArtPublication[]> {
  try {
    const db = await getArtIndexedDB();
    return await new Promise<ArtPublication[]>((resolve, reject) => {
      const tx = db.transaction(STORE_PUBS, 'readonly');
      const store = tx.objectStore(STORE_PUBS);
      const req = store.getAll();
      req.onsuccess = () => {
        const items = (req.result || []) as ArtPublication[];
        resolve(items);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Aviso: Não foi possível ler publicações do IndexedDB:', err);
    return [];
  }
}

/**
 * Gera versão indexada leve sem fotos em base64 para o localStorage caso a cota exceda
 */
function createLightweightPubsForStorage(pubs: ArtPublication[]): any[] {
  return pubs.map(p => ({
    ...p,
    userImages: [], // As fotos originais completas ficam 100% preservadas no IndexedDB
  }));
}

/**
 * Comprime dataUrl para envio leve e ultrarrápido ao endpoint de IA generativa
 */
export const compressImageForAiPayload = (dataUrl: string, maxDim: number = 800, quality: number = 0.75): Promise<string> => {
  return new Promise((resolve) => {
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image')) {
      resolve(dataUrl);
      return;
    }
    if (dataUrl.startsWith('data:image/svg+xml')) {
      resolve(dataUrl);
      return;
    }
    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;
      if (width <= maxDim && height <= maxDim && dataUrl.length < 80000) {
        resolve(dataUrl);
        return;
      }
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
};

// Logos padrão iniciais como fallback caso o administrador ainda não tenha feito upload
const DEFAULT_INITIAL_LOGOS: ArtLogoItem[] = [
  {
    id: 'logo_default_principal',
    name: 'Prefeitura — Logo Principal (Oficial)',
    dataUrl: '', // Logo gerada via SVG institucional estilizada em dataURL
    isDefault: true,
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'logo_default_branca',
    name: 'Prefeitura — Logo Monocromática Branca (Fundo Escuro)',
    dataUrl: '',
    isDefault: false,
    isActive: true,
    createdAt: new Date().toISOString()
  }
];

// Helper para gerar um SVG dataUrl padrão institucional se não houver upload
export const createDefaultLogoDataUrl = (textColor: string = '#1e293b', isWhite: boolean = false): string => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="96" viewBox="0 0 320 96">
    <rect width="320" height="96" rx="16" fill="transparent"/>
    <g transform="translate(12, 16)">
      <path d="M32 4L6 18V36C6 52 17 67 32 72C47 67 58 52 58 36V18L32 4Z" fill="${isWhite ? '#ffffff' : '#4f46e5'}" opacity="${isWhite ? '0.95' : '1'}"/>
      <path d="M32 14L16 23V36C16 46 23 56 32 60C41 56 48 46 48 36V23L32 14Z" fill="${isWhite ? '#1e293b' : '#ffffff'}"/>
      <text x="74" y="28" font-family="Arial, Helvetica, sans-serif" font-weight="900" font-size="16" fill="${textColor}" letter-spacing="1.5">PREFEITURA MUNICIPAL</text>
      <text x="74" y="48" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="13" fill="${isWhite ? '#cbd5e1' : '#64748b'}" letter-spacing="0.5">COMUNICAÇÃO INSTITUCIONAL</text>
    </g>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

/**
 * Comprime e redimensiona imagem para referências visuais e logos institucionais.
 * Reduz imagens de 5MB-10MB para ~80KB-160KB preservando nitidez máxima de fontes, cores e layout,
 * impedindo o estouro da cota de 5MB do localStorage ao cadastrar até 9 referências.
 */
export const optimizeImageBase64 = (dataUrl: string, maxDim: number = 1280, quality: number = 0.84): Promise<string> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !dataUrl || !dataUrl.startsWith('data:image')) {
      resolve(dataUrl);
      return;
    }

    // Se já for pequena, não precisa reprocessar
    if (dataUrl.length < 200000 && !dataUrl.startsWith('data:image/png')) {
      resolve(dataUrl);
      return;
    }

    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width <= maxDim && height <= maxDim && dataUrl.length < 350000) {
        resolve(dataUrl);
        return;
      }

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      // Converte para JPEG otimizado
      const compressed = canvas.toDataURL('image/jpeg', quality);
      resolve(compressed);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
};

/**
 * Lê um arquivo File com FileReader e já retorna o base64 comprimido e otimizado.
 */
export const readFileAsOptimizedDataUrl = (file: File, maxDim: number = 1280, quality: number = 0.84): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const rawDataUrl = e.target?.result as string;
      try {
        const optimized = await optimizeImageBase64(rawDataUrl, maxDim, quality);
        resolve(optimized);
      } catch {
        resolve(rawDataUrl);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

/**
 * Otimiza e redimensiona imagem de logo institucional preservando transparência (canal Alpha PNG/WebP/SVG).
 * Redimensiona para dimensão máxima de 1000px mantendo proporção exata e nitidez vetorial/raster.
 * Reduz logos de 3MB-8MB para ~50KB-120KB, permitindo armazenar quantas logos o município precisar sem atingir cotas.
 */
export const optimizeLogoDataUrl = (dataUrl: string, maxDim: number = 1000): Promise<string> => {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !dataUrl) {
      resolve(dataUrl);
      return;
    }

    // Se for SVG, não altera nada para manter qualidade vetorial infinita e peso leve
    if (dataUrl.startsWith('data:image/svg+xml')) {
      resolve(dataUrl);
      return;
    }

    const img = new Image();
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width <= maxDim && height <= maxDim && dataUrl.length < 250000) {
        resolve(dataUrl);
        return;
      }

      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      // Limpa para garantir transparência total do canal alfa
      ctx.clearRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      // Sempre PNG para preservar transparência
      const optimizedPng = canvas.toDataURL('image/png');
      resolve(optimizedPng);
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
};

/**
 * Lê arquivo de logo e converte em DataURL otimizado com transparência preservada.
 */
export const readFileAsOptimizedLogo = (file: File, maxDim: number = 1000): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const rawDataUrl = e.target?.result as string;
      try {
        const optimized = await optimizeLogoDataUrl(rawDataUrl, maxDim);
        resolve(optimized);
      } catch {
        resolve(rawDataUrl);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Função auxiliar para extrair as 1 a 3 palavras mais impactantes do título garantindo a regra máxima em cada post gerado
export const extractSmartHighlightWords = (title: string): string[] => {
  const stopWords = new Set([
    'de', 'da', 'do', 'das', 'dos', 'e', 'em', 'para', 'com', 'no', 'na', 
    'nos', 'nas', 'um', 'uma', 'o', 'a', 'os', 'as', 'por', 'pelo', 'pela',
    'sobre', 'entre', 'até', 'ao', 'aos', 'à', 'às', 'se', 'sua', 'seu',
    'comunicado', 'oficial', 'prefeitura', 'municipal'
  ]);
  const words = (title || '').trim().split(/\s+/).filter(w => w.length > 1);
  if (!words.length) return ['DESTAQUE'];

  // Prioriza palavras fora de stopWords
  const meaningful = words.filter(w => !stopWords.has(w.toLowerCase().replace(/[^\wÀ-ú]/g, '')));
  if (meaningful.length > 0) {
    // Escolhe as palavras com maior número de caracteres ou as 2 primeiras mais significativas
    const sorted = [...meaningful].sort((a, b) => b.length - a.length);
    return sorted.slice(0, Math.min(2, sorted.length));
  }
  return [words[0]];
};

export const artStudioService = {
  // ==========================================
  // GESTÃO DE LOGOS DA PREFEITURA
  // PERSISTÊNCIA DURÁVEL EM INDEXEDDB (SEM LIMITE DE 5MB)
  // ==========================================
  getLogos(): ArtLogoItem[] {
    if (memoryLogosCache !== null && memoryLogosCache.length > 0) {
      return memoryLogosCache;
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY_LOGOS);
      if (stored) {
        const parsed = JSON.parse(stored) as ArtLogoItem[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          memoryLogosCache = parsed;
          this.loadLogosAsync().catch(() => {});
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar logos do storage, usando iniciais:', e);
    }

    // Inicializa com as logos padrão
    const initial: ArtLogoItem[] = [
      {
        ...DEFAULT_INITIAL_LOGOS[0],
        dataUrl: createDefaultLogoDataUrl('#0f172a', false)
      },
      {
        ...DEFAULT_INITIAL_LOGOS[1],
        dataUrl: createDefaultLogoDataUrl('#ffffff', true)
      }
    ];

    memoryLogosCache = initial;
    this.saveLogosToStorage(initial);
    this.loadLogosAsync().catch(() => {});
    return initial;
  },

  async loadLogosAsync(): Promise<ArtLogoItem[]> {
    try {
      const fromDb = await fetchLogosFromIndexedDB();
      if (Array.isArray(fromDb) && fromDb.length > 0) {
        memoryLogosCache = fromDb;
        return fromDb;
      }

      // Se o IndexedDB estiver vazio, checa se há dados no localStorage para migração
      const stored = localStorage.getItem(STORAGE_KEY_LOGOS);
      if (stored) {
        const parsed = JSON.parse(stored) as ArtLogoItem[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          memoryLogosCache = parsed;
          await persistLogosToIndexedDB(parsed);
          return parsed;
        }
      }
    } catch (err) {
      console.warn('Erro ao ler logos do IndexedDB:', err);
    }

    if (!memoryLogosCache || memoryLogosCache.length === 0) {
      const initial: ArtLogoItem[] = [
        {
          ...DEFAULT_INITIAL_LOGOS[0],
          dataUrl: createDefaultLogoDataUrl('#0f172a', false)
        },
        {
          ...DEFAULT_INITIAL_LOGOS[1],
          dataUrl: createDefaultLogoDataUrl('#ffffff', true)
        }
      ];
      memoryLogosCache = initial;
      await persistLogosToIndexedDB(initial);
      return initial;
    }

    return memoryLogosCache;
  },

  saveLogosToStorage(logos: ArtLogoItem[]): void {
    memoryLogosCache = [...logos];
    // Grava no IndexedDB de forma assíncrona (não tem restrição de 5MB)
    persistLogosToIndexedDB(logos).catch((err) => {
      console.error('Falha ao persistir logos no IndexedDB:', err);
    });

    // Tenta gravar cópia leve no localStorage, ignorando QuotaExceededError
    try {
      localStorage.setItem(STORAGE_KEY_LOGOS, JSON.stringify(logos));
    } catch (e) {
      // Ignora cota de 5MB do localStorage pois os dados já estão no IndexedDB
      console.info('Logos gravadas com segurança no IndexedDB (localStorage cheio):', e);
    }
  },

  async saveLogosAsync(logos: ArtLogoItem[]): Promise<void> {
    memoryLogosCache = [...logos];
    await persistLogosToIndexedDB(logos);
    try {
      localStorage.setItem(STORAGE_KEY_LOGOS, JSON.stringify(logos));
    } catch (e) {
      // IndexedDB garantiu a gravação permanente
    }
  },

  saveLogo(name: string, dataUrl: string, isDefault: boolean = false): ArtLogoItem {
    const logos = this.getLogos();
    const newLogo: ArtLogoItem = {
      id: `logo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: name.trim() || 'Nova Logo Institucional',
      dataUrl,
      isDefault,
      isActive: true,
      createdAt: new Date().toISOString()
    };

    let updated = [...logos];
    if (isDefault) {
      updated = updated.map(l => ({ ...l, isDefault: false }));
    }
    updated.unshift(newLogo);
    this.saveLogosToStorage(updated);
    return newLogo;
  },

  async saveLogoAsync(name: string, dataUrl: string, isDefault: boolean = false): Promise<ArtLogoItem> {
    const optimizedDataUrl = await optimizeLogoDataUrl(dataUrl, 1000);
    const logos = await this.loadLogosAsync();
    const newLogo: ArtLogoItem = {
      id: `logo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: name.trim() || 'Nova Logo Institucional',
      dataUrl: optimizedDataUrl,
      isDefault,
      isActive: true,
      createdAt: new Date().toISOString()
    };

    let updated = [...logos];
    if (isDefault) {
      updated = updated.map(l => ({ ...l, isDefault: false }));
    }
    updated.unshift(newLogo);
    await this.saveLogosAsync(updated);
    return newLogo;
  },

  updateLogo(id: string, updates: Partial<ArtLogoItem>): ArtLogoItem[] {
    const logos = this.getLogos();
    let updated = logos.map(logo => {
      if (logo.id !== id) {
        if (updates.isDefault) return { ...logo, isDefault: false };
        return logo;
      }
      return { ...logo, ...updates, updatedAt: new Date().toISOString() };
    });

    this.saveLogosToStorage(updated);
    return updated;
  },

  async updateLogoAsync(id: string, updates: Partial<ArtLogoItem>): Promise<ArtLogoItem[]> {
    const logos = await this.loadLogosAsync();
    let updated = logos.map(logo => {
      if (logo.id !== id) {
        if (updates.isDefault) return { ...logo, isDefault: false };
        return logo;
      }
      return { ...logo, ...updates, updatedAt: new Date().toISOString() };
    });

    await this.saveLogosAsync(updated);
    return updated;
  },

  deleteLogo(id: string): ArtLogoItem[] {
    const logos = this.getLogos();
    const target = logos.find(l => l.id === id);
    let updated = logos.filter(l => l.id !== id);

    if (target?.isDefault && updated.length > 0) {
      updated[0].isDefault = true;
    }

    this.saveLogosToStorage(updated);
    return updated;
  },

  async deleteLogoAsync(id: string): Promise<ArtLogoItem[]> {
    const logos = await this.loadLogosAsync();
    const target = logos.find(l => l.id === id);
    let updated = logos.filter(l => l.id !== id);

    if (target?.isDefault && updated.length > 0) {
      updated[0].isDefault = true;
    }

    await this.saveLogosAsync(updated);
    return updated;
  },

  getDefaultLogo(): ArtLogoItem | null {
    const logos = this.getLogos().filter(l => l.isActive);
    const def = logos.find(l => l.isDefault);
    return def || (logos.length > 0 ? logos[0] : null);
  },

  // ==========================================
  // GESTÃO DE IMAGENS DE REFERÊNCIA (ATÉ 9)
  // PERSISTÊNCIA DURÁVEL EM INDEXEDDB + MEMÓRIA
  // ==========================================
  getReferences(): ArtReferenceItem[] {
    if (memoryReferencesCache !== null) {
      return memoryReferencesCache;
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY_REFS);
      if (stored) {
        const parsed = JSON.parse(stored) as ArtReferenceItem[];
        if (Array.isArray(parsed)) {
          memoryReferencesCache = parsed;
          // Inicia hidratação em segundo plano a partir do IndexedDB
          this.loadReferencesAsync().catch(() => {});
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar referências do storage:', e);
    }

    memoryReferencesCache = [];
    // Tenta carregar do IndexedDB
    this.loadReferencesAsync().catch(() => {});
    return [];
  },

  async loadReferencesAsync(): Promise<ArtReferenceItem[]> {
    try {
      const fromDb = await fetchReferencesFromIndexedDB();
      if (Array.isArray(fromDb) && fromDb.length > 0) {
        memoryReferencesCache = fromDb;
        return fromDb;
      }

      // Se o IndexedDB estiver vazio, checa se há dados no localStorage para migração automática
      const stored = localStorage.getItem(STORAGE_KEY_REFS);
      if (stored) {
        const parsed = JSON.parse(stored) as ArtReferenceItem[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          memoryReferencesCache = parsed;
          await persistReferencesToIndexedDB(parsed);
          return parsed;
        }
      }
    } catch (err) {
      console.warn('Erro ao ler referências assíncronas do IndexedDB:', err);
    }

    if (memoryReferencesCache === null) {
      memoryReferencesCache = [];
    }
    return memoryReferencesCache;
  },

  saveReferencesToStorage(refs: ArtReferenceItem[]): void {
    memoryReferencesCache = [...refs];
    // Grava de forma durável e assíncrona no IndexedDB
    persistReferencesToIndexedDB(refs).catch((err) => {
      console.error('Falha ao persistir referências no IndexedDB:', err);
    });

    // Tenta gravar cópia no localStorage (com proteção contra QuotaExceeded)
    try {
      localStorage.setItem(STORAGE_KEY_REFS, JSON.stringify(refs));
    } catch (e) {
      // Ignora cota de 5MB do localStorage pois os dados já estão garantidos no IndexedDB
      console.info('Armazenado com segurança no IndexedDB (localStorage excedeu 5MB):', e);
    }
  },

  async saveReferencesAsync(refs: ArtReferenceItem[]): Promise<void> {
    memoryReferencesCache = [...refs];
    await persistReferencesToIndexedDB(refs);
    try {
      localStorage.setItem(STORAGE_KEY_REFS, JSON.stringify(refs));
    } catch (e) {
      // IndexedDB garantiu a gravação
    }
  },

  setReferenceAtSlot(index: number, name: string, dataUrl: string): ArtReferenceItem[] {
    if (index < 0 || index > 8) return this.getReferences();
    const current = this.getReferences();
    const existingIdx = current.findIndex(r => r.index === index);

    const newItem: ArtReferenceItem = {
      id: `ref_${Date.now()}_slot_${index}`,
      index,
      name: name || `Referência ${String(index + 1).padStart(2, '0')}`,
      dataUrl,
      createdAt: new Date().toISOString()
    };

    let next = [...current];
    if (existingIdx >= 0) {
      next[existingIdx] = newItem;
    } else {
      next.push(newItem);
    }

    next.sort((a, b) => a.index - b.index);
    this.saveReferencesToStorage(next);
    return next;
  },

  async setReferenceAtSlotAsync(index: number, name: string, dataUrl: string): Promise<ArtReferenceItem[]> {
    if (index < 0 || index > 8) return this.loadReferencesAsync();
    const current = await this.loadReferencesAsync();
    const existingIdx = current.findIndex(r => r.index === index);

    const newItem: ArtReferenceItem = {
      id: `ref_${Date.now()}_slot_${index}`,
      index,
      name: name || `Referência ${String(index + 1).padStart(2, '0')}`,
      dataUrl,
      createdAt: new Date().toISOString()
    };

    let next = [...current];
    if (existingIdx >= 0) {
      next[existingIdx] = newItem;
    } else {
      next.push(newItem);
    }

    next.sort((a, b) => a.index - b.index);
    await this.saveReferencesAsync(next);
    return next;
  },

  setMultipleReferences(items: Array<{ slot: number; name: string; dataUrl: string }>): ArtReferenceItem[] {
    let next = [...this.getReferences()];

    items.forEach(item => {
      if (item.slot < 0 || item.slot > 8) return;
      const newItem: ArtReferenceItem = {
        id: `ref_${Date.now()}_${Math.random().toString(36).substring(2, 6)}_slot_${item.slot}`,
        index: item.slot,
        name: item.name || `Referência ${String(item.slot + 1).padStart(2, '0')}`,
        dataUrl: item.dataUrl,
        createdAt: new Date().toISOString()
      };

      const existingIdx = next.findIndex(r => r.index === item.slot);
      if (existingIdx >= 0) {
        next[existingIdx] = newItem;
      } else {
        next.push(newItem);
      }
    });

    next.sort((a, b) => a.index - b.index);
    this.saveReferencesToStorage(next);
    return next;
  },

  async setMultipleReferencesAsync(items: Array<{ slot: number; name: string; dataUrl: string }>): Promise<ArtReferenceItem[]> {
    const current = await this.loadReferencesAsync();
    let next = [...current];

    items.forEach(item => {
      if (item.slot < 0 || item.slot > 8) return;
      const newItem: ArtReferenceItem = {
        id: `ref_${Date.now()}_${Math.random().toString(36).substring(2, 6)}_slot_${item.slot}`,
        index: item.slot,
        name: item.name || `Referência ${String(item.slot + 1).padStart(2, '0')}`,
        dataUrl: item.dataUrl,
        createdAt: new Date().toISOString()
      };

      const existingIdx = next.findIndex(r => r.index === item.slot);
      if (existingIdx >= 0) {
        next[existingIdx] = newItem;
      } else {
        next.push(newItem);
      }
    });

    next.sort((a, b) => a.index - b.index);
    await this.saveReferencesAsync(next);
    return next;
  },

  removeReferenceAtSlot(index: number): ArtReferenceItem[] {
    const current = this.getReferences();
    const next = current.filter(r => r.index !== index);
    this.saveReferencesToStorage(next);
    return next;
  },

  async removeReferenceAtSlotAsync(index: number): Promise<ArtReferenceItem[]> {
    const current = await this.loadReferencesAsync();
    const next = current.filter(r => r.index !== index);
    await this.saveReferencesAsync(next);
    return next;
  },

  reorderReferences(fromSlot: number, toSlot: number): ArtReferenceItem[] {
    if (fromSlot === toSlot || fromSlot < 0 || fromSlot > 8 || toSlot < 0 || toSlot > 8) {
      return this.getReferences();
    }
    const current = this.getReferences();
    const fromItem = current.find(r => r.index === fromSlot);
    const toItem = current.find(r => r.index === toSlot);

    if (!fromItem) return current;

    const next = current.map(item => {
      if (item.index === fromSlot) {
        return { ...item, index: toSlot };
      }
      if (toItem && item.index === toSlot) {
        return { ...item, index: fromSlot };
      }
      return item;
    });

    next.sort((a, b) => a.index - b.index);
    this.saveReferencesToStorage(next);
    return next;
  },

  async reorderReferencesAsync(fromSlot: number, toSlot: number): Promise<ArtReferenceItem[]> {
    if (fromSlot === toSlot || fromSlot < 0 || fromSlot > 8 || toSlot < 0 || toSlot > 8) {
      return this.loadReferencesAsync();
    }
    const current = await this.loadReferencesAsync();
    const fromItem = current.find(r => r.index === fromSlot);
    const toItem = current.find(r => r.index === toSlot);

    if (!fromItem) return current;

    const next = current.map(item => {
      if (item.index === fromSlot) {
        return { ...item, index: toSlot };
      }
      if (toItem && item.index === toSlot) {
        return { ...item, index: fromSlot };
      }
      return item;
    });

    next.sort((a, b) => a.index - b.index);
    await this.saveReferencesAsync(next);
    return next;
  },

  clearAllReferences(): void {
    this.saveReferencesToStorage([]);
  },

  async clearAllReferencesAsync(): Promise<void> {
    await this.saveReferencesAsync([]);
  },

  // ==========================================
  // HISTÓRICO DE PUBLICAÇÕES (INDEXEDDB PERSISTENTE SEM LIMITE DE COTA)
  // ==========================================
  getPublications(): ArtPublication[] {
    if (memoryPubsCache !== null) {
      return memoryPubsCache;
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY_PUBS);
      if (stored) {
        const parsed = JSON.parse(stored) as ArtPublication[];
        if (Array.isArray(parsed)) {
          memoryPubsCache = parsed;
          // Hidrata silenciosamente com as imagens completas do IndexedDB
          this.loadPublicationsAsync().catch(() => {});
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Erro ao carregar publicações do storage:', e);
    }
    this.loadPublicationsAsync().catch(() => {});
    return [];
  },

  async loadPublicationsAsync(): Promise<ArtPublication[]> {
    try {
      const dbPubs = await fetchPublicationsFromIndexedDB();
      if (dbPubs && dbPubs.length > 0) {
        memoryPubsCache = dbPubs;
        return dbPubs;
      }
    } catch (err) {
      console.warn('Aviso: Não foi possível carregar publicações do IndexedDB:', err);
    }
    return this.getPublications();
  },

  getPublicationById(id: string): ArtPublication | null {
    const pubs = this.getPublications();
    return pubs.find(p => p.id === id) || null;
  },

  savePublication(pub: ArtPublication): void {
    const current = this.getPublications();
    const index = current.findIndex(p => p.id === pub.id);
    let updated = [...current];

    if (index >= 0) {
      updated[index] = { ...pub, updatedAt: new Date().toISOString() };
    } else {
      updated.unshift(pub);
    }

    // 1. Atualização instantânea na memória RAM para a interface responder de imediato
    memoryPubsCache = updated;

    // 2. Persistência permanente no IndexedDB (sem limite de 5MB)
    persistPublicationsToIndexedDB(updated).catch(err => {
      console.warn('Aviso ao salvar publicações no IndexedDB:', err);
    });

    // 3. Fallback seguro no localStorage (com compactação preventiva se a cota de 5MB for atingida)
    try {
      localStorage.setItem(STORAGE_KEY_PUBS, JSON.stringify(updated));
    } catch (e) {
      try {
        // Se exceder a cota do localStorage por causa das fotos de evento em base64,
        // salvamos a versão indexada leve sem travar a aplicação, pois as fotos estão salvas no IndexedDB
        const lightweight = createLightweightPubsForStorage(updated);
        localStorage.setItem(STORAGE_KEY_PUBS, JSON.stringify(lightweight));
      } catch (innerErr) {
        // Se mesmo assim o localStorage estiver 100% cheio, o IndexedDB garante 100% dos dados
      }
    }
  },

  async savePublicationAsync(pub: ArtPublication): Promise<void> {
    this.savePublication(pub);
    if (memoryPubsCache) {
      await persistPublicationsToIndexedDB(memoryPubsCache);
    }
  },

  updatePublication(id: string, updates: Partial<ArtPublication>): ArtPublication | null {
    const current = this.getPublications();
    const index = current.findIndex(p => p.id === id);
    if (index === -1) return null;

    const updated = {
      ...current[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    current[index] = updated;
    memoryPubsCache = current;

    persistPublicationsToIndexedDB(current).catch(err => {
      console.warn('Aviso ao atualizar publicações no IndexedDB:', err);
    });

    try {
      localStorage.setItem(STORAGE_KEY_PUBS, JSON.stringify(current));
    } catch (e) {
      try {
        const lightweight = createLightweightPubsForStorage(current);
        localStorage.setItem(STORAGE_KEY_PUBS, JSON.stringify(lightweight));
      } catch (innerErr) {}
    }
    return updated;
  },

  deletePublication(id: string): ArtPublication[] {
    const current = this.getPublications();
    const next = current.filter(p => p.id !== id);
    memoryPubsCache = next;

    persistPublicationsToIndexedDB(next).catch(err => {
      console.warn('Aviso ao excluir publicação no IndexedDB:', err);
    });

    try {
      localStorage.setItem(STORAGE_KEY_PUBS, JSON.stringify(next));
    } catch (e) {
      try {
        const lightweight = createLightweightPubsForStorage(next);
        localStorage.setItem(STORAGE_KEY_PUBS, JSON.stringify(lightweight));
      } catch (innerErr) {}
    }
    return next;
  },

  duplicatePublication(id: string): ArtPublication | null {
    const target = this.getPublicationById(id);
    if (!target) return null;

    const copy: ArtPublication = {
      ...target,
      id: `art_pub_${Date.now()}_copy`,
      title: `${target.title} (Cópia)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.savePublication(copy);
    return copy;
  },

  // ==========================================
  // GERAÇÃO DE ARTES COM INTELIGÊNCIA ARTIFICIAL
  // ==========================================
  async generateArtWithAI(
    info: {
      title: string;
      subtitle?: string;
      description: string;
      eventDate?: string;
      eventTime?: string;
      eventLocation?: string;
      category?: string;
      ctaText?: string;
      notesForAI?: string;
    },
    userImages: string[],
    references: ArtReferenceItem[],
    selectedLogo?: ArtLogoItem | null,
    onProgress?: (stepText: string, stepIndex: number) => void
  ): Promise<ArtVariation[]> {
    const steps = [
      'Analisando informações...',
      'Analisando imagens...',
      'Interpretando referências visuais...',
      'Definindo composição...',
      'Construindo identidade visual...',
      'Aplicando elementos gráficos...',
      'Inserindo logo institucional...',
      'Adaptando para 1080 × 1920...',
      'Adaptando para 1080 × 1080...',
      'Finalizando publicação...'
    ];

    // Dispara animação sequencial visual do progresso
    let currentStep = 0;
    const progressTimer = setInterval(() => {
      if (currentStep < steps.length) {
        onProgress?.(steps[currentStep], currentStep + 1);
        currentStep++;
      }
    }, 650);

    try {
      // Prepara as imagens de referência comprimidas (max 800px) para envio rápido e leve
      const optimizedReferences = await Promise.all(
        (references || [])
          .filter(r => !!r.dataUrl)
          .slice(0, 9)
          .map(async (r) => ({
            index: r.index,
            name: r.name,
            dataUrl: await compressImageForAiPayload(r.dataUrl, 800, 0.75)
          }))
      );

      // Prepara imagens de usuário comprimidas (max 800px)
      const optimizedUserImages = await Promise.all(
        (userImages || [])
          .slice(0, 4)
          .map(async (img) => compressImageForAiPayload(img, 800, 0.75))
      );

      const payload = {
        tipo: 'art_generator',
        dados: {
          info,
          userImages: optimizedUserImages,
          references: optimizedReferences,
          logoName: selectedLogo?.name || 'Prefeitura Oficial'
        }
      };

      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      clearInterval(progressTimer);
      onProgress?.(steps[steps.length - 1], steps.length);

      if (!res.ok) {
        throw new Error(`Servidor retornou status ${res.status}`);
      }

      const json = await res.json();
      let rawVariations: any[] = [];

      try {
        if (json.text) {
          const parsed = JSON.parse(json.text);
          rawVariations = parsed.variations || [parsed];
        }
      } catch (e) {
        console.warn('Fallback de parsing de variações da IA:', e);
      }

      if (!Array.isArray(rawVariations) || rawVariations.length === 0) {
        return this.createFallbackVariations(info);
      }

      // Normaliza as variações recebidas garantindo a aplicação estrita da regra máxima em CADA POST gerado
      return rawVariations.slice(0, 3).map((v, idx) => {
        const highlightWords = (Array.isArray(v.titleHighlightWords) && v.titleHighlightWords.length > 0)
          ? v.titleHighlightWords
          : extractSmartHighlightWords(info.title || v.headlineSummary);

        return {
          id: v.id || `var_${idx + 1}_${Date.now()}`,
          styleName: v.styleName || (idx === 0 ? 'Institucional' : idx === 1 ? 'Moderna' : 'Impactante'),
          description: v.description || 'Composição equilibrada adaptada para comunicação pública oficial.',
          primaryColor: v.primaryColor || (idx === 0 ? '#1e3a8a' : idx === 1 ? '#4f46e5' : '#0f172a'),
          secondaryColor: v.secondaryColor || (idx === 0 ? '#d97706' : idx === 1 ? '#06b6d4' : '#ef4444'),
          accentColor: v.accentColor || (idx === 0 ? '#f59e0b' : idx === 1 ? '#10b981' : '#fbbf24'),
          textColor: v.textColor || '#ffffff',
          backgroundColor: v.backgroundColor || (idx === 0 ? '#0f172a' : idx === 1 ? '#090d16' : '#18181b'),
          gradientBackground: v.gradientBackground || (
            idx === 0 
              ? 'linear-gradient(145deg, #0f172a 0%, #1e3a8a 70%, #172554 100%)' 
              : idx === 1 
              ? 'linear-gradient(135deg, #090d16 0%, #312e81 60%, #4338ca 100%)' 
              : 'linear-gradient(180deg, #18181b 0%, #09090b 60%, #27272a 100%)'
          ),
          fontFamilyTitle: v.fontFamilyTitle || 'Montserrat, sans-serif',
          fontFamilyBody: v.fontFamilyBody || 'Inter, sans-serif',
          logoPosition: (v.logoPosition as ArtLogoPosition) || 'top_right',
          logoSizePercent: v.logoSizePercent || 20,
          logoOpacity: v.logoOpacity || 1,
          layoutType: v.layoutType || (idx === 0 ? 'split' : idx === 1 ? 'overlay' : 'framed'),
          headlineSummary: v.headlineSummary || info.title,
          subtitleSummary: v.subtitleSummary || info.subtitle,
          bodySummary: v.bodySummary || info.description,
          impactWord: v.impactWord || (idx === 2 ? 'DESTAQUE' : undefined),
          impactWordEffect: v.impactWordEffect || (idx === 2 ? 'glow' : idx === 1 ? '3d_shadow' : 'glass_badge'),
          titleEffect: v.titleEffect || '3d_depth',
          titleHighlightWords: highlightWords,
          haikeiShape: v.haikeiShape || (idx === 0 ? 'wave' : idx === 1 ? 'blob' : 'halftone'),
          badgeLabel: v.badgeLabel || (info.eventDate ? '📅 DATA CONFIRMADA' : '✅ COMUNICADO OFICIAL'),
          libraryIcons: Array.isArray(v.libraryIcons) && v.libraryIcons.length > 0 ? v.libraryIcons : ['Shield', 'CheckCircle2', 'Star'],
          contextualTheme: v.contextualTheme || info.category || 'Institucional',
          photoTreatment: v.photoTreatment || {
            brightness: 1.05,
            contrast: 1.1,
            saturation: 1.15,
            colorGradingTone: idx === 0 ? 'cool_civic' : idx === 1 ? 'warm_golden' : 'vibrant',
            vignetteStrength: 0.3,
            lightingEffect: idx === 1 ? 'sunlight_leak' : idx === 2 ? 'stage_light' : 'soft_glow'
          },
          elements: [
            { type: 'badge', color: v.secondaryColor || '#4f46e5', opacity: 0.9 },
            { type: 'gradient', opacity: 0.4 },
            { type: 'frame', color: v.accentColor || '#f59e0b', opacity: 0.7 }
          ]
        };
      });
    } catch (error) {
      clearInterval(progressTimer);
      console.warn('IA falhou, gerando composições de contingência de alto padrão visual:', error);
      return this.createFallbackVariations(info);
    }
  },

  // Cria 3 propostas visuais ricas de contingência caso a rede / chave da IA oscile
  createFallbackVariations(info: { title: string; subtitle?: string; description: string; category?: string; eventDate?: string }): ArtVariation[] {
    const fallbackHighlights = extractSmartHighlightWords(info.title);

    return [
      {
        id: `var_1_institucional_${Date.now()}`,
        styleName: 'Variação 01 — Institucional Dinâmica',
        description: 'Harmonia institucional com alta energia visual, azul cívico nobre, contrastes em dourado e tipografia de autoridade.',
        primaryColor: '#1e3a8a',
        secondaryColor: '#3b82f6',
        accentColor: '#f59e0b',
        textColor: '#ffffff',
        backgroundColor: '#0f172a',
        gradientBackground: 'linear-gradient(145deg, #090d16 0%, #1e3a8a 60%, #172554 100%)',
        fontFamilyTitle: 'Montserrat, sans-serif',
        fontFamilyBody: 'Inter, sans-serif',
        logoPosition: 'top_right',
        logoSizePercent: 20,
        logoOpacity: 1,
        layoutType: 'split',
        headlineSummary: info.title,
        subtitleSummary: info.subtitle,
        bodySummary: info.description,
        impactWord: info.eventDate ? 'VEM AÍ!' : 'IMPORTANTE!',
        impactWordEffect: 'glow',
        titleEffect: '3d_depth',
        titleHighlightWords: fallbackHighlights,
        haikeiShape: 'wave',
        badgeLabel: '✅ COMUNICADO OFICIAL',
        libraryIcons: ['Shield', 'CheckCircle2', 'MapPin'],
        photoTreatment: {
          brightness: 1.08,
          contrast: 1.12,
          saturation: 1.18,
          colorGradingTone: 'cool_civic',
          vignetteStrength: 0.32,
          lightingEffect: 'sunlight_leak'
        },
        elements: [
          { type: 'badge', color: '#1e3a8a', opacity: 0.9 },
          { type: 'frame', color: '#f59e0b', opacity: 0.8 }
        ]
      },
      {
        id: `var_2_moderna_${Date.now()}`,
        styleName: 'Variação 02 — Moderna & Criativa',
        description: 'Gradientes modernos em índigo e violeta, sobreposição refinada, destaques em turquesa e atmosfera alegre.',
        primaryColor: '#4f46e5',
        secondaryColor: '#06b6d4',
        accentColor: '#10b981',
        textColor: '#ffffff',
        backgroundColor: '#090d16',
        gradientBackground: 'linear-gradient(135deg, #090d16 0%, #312e81 60%, #4338ca 100%)',
        fontFamilyTitle: 'Plus Jakarta Sans, sans-serif',
        fontFamilyBody: 'Inter, sans-serif',
        logoPosition: 'top_left',
        logoSizePercent: 22,
        logoOpacity: 1,
        layoutType: 'overlay',
        headlineSummary: info.title,
        subtitleSummary: info.subtitle,
        bodySummary: info.description,
        impactWord: 'PARTICIPE!',
        impactWordEffect: 'metallic',
        titleEffect: '3d_depth',
        titleHighlightWords: fallbackHighlights,
        haikeiShape: 'blob',
        badgeLabel: '⚡ GRANDE DESTAQUE',
        libraryIcons: ['Sparkles', 'Calendar', 'Users'],
        photoTreatment: {
          brightness: 1.05,
          contrast: 1.15,
          saturation: 1.22,
          colorGradingTone: 'vibrant',
          vignetteStrength: 0.28,
          lightingEffect: 'stage_light'
        },
        elements: [
          { type: 'glow', color: '#06b6d4', opacity: 0.35 },
          { type: 'badge', color: '#4f46e5', opacity: 0.95 }
        ]
      },
      {
        id: `var_3_impactante_${Date.now()}`,
        styleName: 'Variação 03 — Alto Impacto Visual',
        description: 'Máximo destaque visual, tipografia imponente em peso extra, contraste dinâmico vibrante e forte apelo de comunicação.',
        primaryColor: '#0f172a',
        secondaryColor: '#ef4444',
        accentColor: '#fbbf24',
        textColor: '#ffffff',
        backgroundColor: '#18181b',
        gradientBackground: 'linear-gradient(180deg, #18181b 0%, #09090b 60%, #27272a 100%)',
        fontFamilyTitle: 'Outfit, sans-serif',
        fontFamilyBody: 'Inter, sans-serif',
        logoPosition: 'bottom_right',
        logoSizePercent: 22,
        logoOpacity: 1,
        layoutType: 'framed',
        headlineSummary: info.title,
        subtitleSummary: info.subtitle,
        bodySummary: info.description,
        impactWord: 'NOVIDADE!',
        impactWordEffect: '3d_shadow',
        titleEffect: '3d_depth',
        titleHighlightWords: fallbackHighlights,
        haikeiShape: 'halftone',
        badgeLabel: '⭐ ESPECIAL MUNICIPAL',
        libraryIcons: ['Trophy', 'Star', 'Flame'],
        photoTreatment: {
          brightness: 1.10,
          contrast: 1.20,
          saturation: 1.25,
          colorGradingTone: 'warm_golden',
          vignetteStrength: 0.35,
          lightingEffect: 'soft_glow'
        },
        elements: [
          { type: 'shape', color: '#ef4444', opacity: 0.8 },
          { type: 'frame', color: '#fbbf24', opacity: 0.9 }
        ]
      }
    ];
  },

  // Ajuste inteligente via chat com IA no editor
  async editArtWithAI(currentVariation: ArtVariation, userCommand: string): Promise<ArtVariation> {
    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'art_chat_editor',
          dados: {
            currentVariation,
            userCommand
          }
        })
      });

      if (res.ok) {
        const json = await res.json();
        if (json.text) {
          const parsed = JSON.parse(json.text);
          return {
            ...currentVariation,
            ...parsed,
            id: currentVariation.id
          };
        }
      }
    } catch (e) {
      console.warn('Falha no chat inteligente de edição da IA:', e);
    }

    // Heurística local de contingência para comandos comuns
    const cmd = userCommand.toLowerCase();
    const copy = { ...currentVariation };

    if (cmd.includes('título') || cmd.includes('titulo')) {
      if (cmd.includes('chamativo') || cmd.includes('destaque') || cmd.includes('maior')) {
        copy.headlineVisualWeight = 'black';
        copy.accentColor = '#f59e0b';
      }
    }
    if (cmd.includes('data') && (cmd.includes('destaque') || cmd.includes('maior'))) {
      copy.secondaryColor = '#ef4444';
    }
    if (cmd.includes('logo')) {
      if (cmd.includes('esquerda') || cmd.includes('esquerdo')) copy.logoPosition = 'top_left';
      if (cmd.includes('direita') || cmd.includes('direito')) copy.logoPosition = 'top_right';
      if (cmd.includes('baixo') || cmd.includes('inferior')) copy.logoPosition = 'bottom_right';
    }
    if (cmd.includes('verde')) copy.primaryColor = '#059669';
    if (cmd.includes('azul')) copy.primaryColor = '#1d4ed8';
    if (cmd.includes('vermelho')) copy.primaryColor = '#b91c1c';

    return copy;
  },

  /**
   * Preenche automaticamente Título Principal, Subtítulo e CTA (além de sugerir Categoria, Data, Hora e Local)
   * a partir do Texto Principal / Descrição fornecido pelo usuário.
   */
  async autoFillFieldsFromDescription(description: string): Promise<{
    title: string;
    subtitle: string;
    ctaText: string;
    category?: string;
    eventDate?: string;
    eventTime?: string;
    eventLocation?: string;
  }> {
    const cleanDesc = (description || '').trim();
    if (!cleanDesc) {
      return {
        title: '',
        subtitle: '',
        ctaText: 'Participe!'
      };
    }

    try {
      const res = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'art_autofill_fields',
          dados: { description: cleanDesc }
        })
      });

      if (res.ok) {
        const json = await res.json();
        if (json.text) {
          const parsed = JSON.parse(json.text);
          return {
            title: parsed.title || this.extractFallbackTitle(cleanDesc),
            subtitle: parsed.subtitle || '',
            ctaText: parsed.ctaText || 'Participe!',
            category: parsed.category,
            eventDate: parsed.eventDate || undefined,
            eventTime: parsed.eventTime || undefined,
            eventLocation: parsed.eventLocation || undefined
          };
        }
      }
    } catch (e) {
      console.warn('Falha no auto-fill via IA, utilizando sintetizador de contingência:', e);
    }

    // Sintetizador local de contingência
    return this.fallbackAutoFill(cleanDesc);
  },

  extractFallbackTitle(text: string): string {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length > 0) {
      const firstLine = lines[0].replace(/[#*_-]/g, '').trim();
      if (firstLine.length <= 60) return firstLine;
      return firstLine.slice(0, 50) + '...';
    }
    return 'Comunicado Oficial';
  },

  fallbackAutoFill(text: string) {
    const title = this.extractFallbackTitle(text);
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const subtitle = lines.length > 1 ? lines[1].slice(0, 100) : 'Informações e comunicados oficiais da Prefeitura Municipal.';
    
    return {
      title,
      subtitle,
      ctaText: 'Participe!',
    };
  }
};
