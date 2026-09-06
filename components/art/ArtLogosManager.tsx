import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, Upload, Check, Star, Trash2, Edit3, Shield, Image as ImageIcon,
  CheckCircle2, XCircle, Power, RefreshCw, Eye
} from 'lucide-react';
import { ArtLogoItem } from '../../types';
import { artStudioService, readFileAsOptimizedLogo } from '../../services/artStudioService';

interface ArtLogosManagerProps {
  onBack: () => void;
  onNavigate?: (route: string) => void;
}

export const ArtLogosManager: React.FC<ArtLogosManagerProps> = ({ onBack, onNavigate }) => {
  const [logos, setLogos] = useState<ArtLogoItem[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const [previewBg, setPreviewBg] = useState<'dark' | 'light' | 'grid'>('dark');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadLogos = async () => {
    const list = artStudioService.getLogos();
    if (list && list.length > 0) {
      setLogos(list);
    }
    try {
      const fromDb = await artStudioService.loadLogosAsync();
      if (fromDb && fromDb.length > 0) {
        setLogos(fromDb);
      }
    } catch (err) {
      console.warn('Erro ao carregar logos do banco IndexedDB:', err);
    }
  };

  useEffect(() => {
    loadLogos();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const fileList = Array.from(files);
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        if (!file.type.startsWith('image/')) continue;

        // Comprime preservando transparência alfa sem limite de tamanho no IndexedDB
        const optimizedDataUrl = await readFileAsOptimizedLogo(file, 1000);
        const defaultName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        await artStudioService.saveLogoAsync(defaultName, optimizedDataUrl, logos.length === 0 && i === 0);
      }
      const updated = await artStudioService.loadLogosAsync();
      setLogos(updated);
    } catch (err) {
      console.error('Falha ao processar upload da logo:', err);
      alert('Houve um erro ao processar a logo. Tente novamente com PNG ou SVG.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSetDefault = async (id: string) => {
    const updated = await artStudioService.updateLogoAsync(id, { isDefault: true, isActive: true });
    setLogos(updated);
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    const updated = await artStudioService.updateLogoAsync(id, { isActive: !current });
    setLogos(updated);
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Deseja realmente excluir a logo "${name}"?`)) {
      const updated = await artStudioService.deleteLogoAsync(id);
      setLogos(updated);
    }
  };

  const handleSaveRename = async (id: string) => {
    if (editingName.trim()) {
      const updated = await artStudioService.updateLogoAsync(id, { name: editingName.trim() });
      setLogos(updated);
    }
    setEditingId(null);
  };

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] w-full overflow-hidden font-sans">
      {/* Barra de Navegação Superior com ROTA URL /Art/Logos */}
      <header className="shrink-0 bg-white border-b border-slate-200 px-6 md:px-8 py-4 flex items-center justify-between z-30 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            type="button"
            className="p-2.5 rounded-2xl bg-slate-100 text-slate-600 hover:bg-slate-900 hover:text-white transition-all active:scale-95 border border-slate-200/60 cursor-pointer"
            title="Voltar ao Módulo Art"
          >
            <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-0.5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-100">
                /Art/Logos
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
              Logos Oficiais da Prefeitura
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            multiple
            accept="image/png,image/svg+xml,image/jpeg,image/webp"
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider shadow-md shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-60"
          >
            {isUploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            <span>{isUploading ? 'Processando Logo...' : 'Fazer Upload de Logo'}</span>
          </button>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Card de Regras e Instruções Oficiais */}
          <div className="bg-gradient-to-r from-indigo-50/90 via-sky-50/70 to-slate-50 p-5 rounded-3xl border border-indigo-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-2xl bg-indigo-600 text-white shrink-0 shadow-md shadow-indigo-500/20">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-sm md:text-base tracking-tight">
                  Regras de Integridade Institucional
                </h3>
                <p className="text-slate-600 text-xs mt-0.5 leading-relaxed">
                  A logo definida como padrão será inserida automaticamente em todas as publicações geradas. A IA nunca deforma nem altera proporções ou cores originais da logo.
                </p>
              </div>
            </div>

            {/* Alternador de Fundo para Teste de Transparência */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-slate-200/90 shadow-2xs shrink-0 self-end md:self-auto">
              <span className="text-[10px] font-bold text-slate-400 px-2 uppercase">Fundo:</span>
              <button
                type="button"
                onClick={() => setPreviewBg('dark')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  previewBg === 'dark' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Escuro
              </button>
              <button
                type="button"
                onClick={() => setPreviewBg('light')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  previewBg === 'light' ? 'bg-slate-100 text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Claro
              </button>
              <button
                type="button"
                onClick={() => setPreviewBg('grid')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  previewBg === 'grid' ? 'bg-slate-200 text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Grid
              </button>
            </div>
          </div>

          {/* Grade de Logos Cadastradas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {logos.map((logo) => (
              <div
                key={logo.id}
                className={`bg-white rounded-3xl border transition-all overflow-hidden shadow-xs hover:shadow-md flex flex-col justify-between ${
                  logo.isDefault ? 'border-amber-400/90 ring-2 ring-amber-400/20' : 'border-slate-200/90'
                } ${!logo.isActive ? 'opacity-60' : ''}`}
              >
                {/* Visualizador da Imagem com Fundo Selecionado */}
                <div 
                  className={`h-40 p-6 flex items-center justify-center relative overflow-hidden transition-colors ${
                    previewBg === 'dark' 
                      ? 'bg-slate-900' 
                      : previewBg === 'light' 
                      ? 'bg-slate-50' 
                      : 'bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:16px_16px] bg-white'
                  }`}
                >
                  <img
                    src={logo.dataUrl}
                    alt={logo.name}
                    className="max-h-full max-w-full object-contain drop-shadow-md"
                  />

                  {logo.isDefault && (
                    <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-amber-500 text-white text-[10px] font-black uppercase tracking-wider shadow-md flex items-center gap-1">
                      <Star className="w-3 h-3 fill-current" />
                      <span>Logo Padrão</span>
                    </div>
                  )}
                </div>

                {/* Dados da Logo */}
                <div className="p-5 flex-1 flex flex-col justify-between border-t border-slate-100">
                  <div>
                    {editingId === logo.id ? (
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="flex-1 px-3 py-1.5 bg-slate-50 border border-indigo-300 rounded-xl text-xs font-bold outline-none"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveRename(logo.id)}
                          className="p-1.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <h4 className="font-black text-sm text-slate-900 truncate" title={logo.name}>
                          {logo.name}
                        </h4>
                        <button
                          type="button"
                          onClick={() => { setEditingId(logo.id); setEditingName(logo.name); }}
                          className="p-1 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors cursor-pointer"
                          title="Renomear"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    <span className="text-[10px] font-bold text-slate-400">
                      Cadastrada em {new Date(logo.createdAt).toLocaleDateString('pt-BR')}
                    </span>
                  </div>

                  {/* Ações da Logo */}
                  <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100 gap-2">
                    <div className="flex items-center gap-1">
                      {!logo.isDefault && (
                        <button
                          type="button"
                          onClick={() => handleSetDefault(logo.id)}
                          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200 border border-slate-200 text-slate-600 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                          title="Definir como Logo Padrão das Artes"
                        >
                          <Star className="w-3.5 h-3.5" />
                          <span>Tornar Padrão</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleToggleActive(logo.id, logo.isActive)}
                        className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                          logo.isActive 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : 'bg-slate-100 text-slate-400 border-slate-200'
                        }`}
                        title={logo.isActive ? 'Desativar logo' : 'Ativar logo'}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                    </div>

                    {!logo.isDefault && logos.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDelete(logo.id, logo.name)}
                        className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                        title="Excluir logo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};
