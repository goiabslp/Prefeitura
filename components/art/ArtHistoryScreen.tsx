import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Search, Calendar, Sparkles, Sliders, Copy, Trash2,
  Download, Eye, Image as ImageIcon, Plus, Shield
} from 'lucide-react';
import { ArtPublication } from '../../types';
import { artStudioService } from '../../services/artStudioService';

interface ArtHistoryScreenProps {
  onBack: () => void;
  onNavigate: (route: string) => void;
  onSelectPublication: (pubId: string) => void;
}

export const ArtHistoryScreen: React.FC<ArtHistoryScreenProps> = ({
  onBack,
  onNavigate,
  onSelectPublication
}) => {
  const [publications, setPublications] = useState<ArtPublication[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const loadPublications = () => {
    const list = artStudioService.getPublications();
    setPublications(list);

    artStudioService.loadPublicationsAsync().then((asyncList) => {
      if (asyncList && asyncList.length > 0) {
        setPublications(asyncList);
      }
    }).catch(() => {});
  };

  useEffect(() => {
    loadPublications();
  }, []);

  const handleDelete = (id: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Deseja realmente excluir a arte "${title}" do histórico?`)) {
      const updated = artStudioService.deletePublication(id);
      setPublications(updated);
    }
  };

  const handleDuplicate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const copy = artStudioService.duplicatePublication(id);
    if (copy) {
      loadPublications();
      alert('Publicação duplicada com sucesso!');
    }
  };

  const filtered = publications.filter(p => {
    const term = searchTerm.toLowerCase();
    const matchText = (p.title || '').toLowerCase().includes(term) ||
      (p.category || '').toLowerCase().includes(term) ||
      (p.description || '').toLowerCase().includes(term);
    const matchCat = filterCategory === 'all' || p.category === filterCategory;
    return matchText && matchCat;
  });

  const allCategories = Array.from(new Set(publications.map(p => p.category).filter(Boolean)));

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] w-full overflow-hidden font-sans">
      {/* Barra de Navegação Superior com ROTA URL /Art/Historico */}
      <header className="shrink-0 bg-white border-b border-slate-200 px-6 md:px-8 py-4 flex items-center justify-between z-30 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            type="button"
            className="p-2.5 rounded-2xl bg-slate-100 text-slate-600 hover:bg-slate-900 hover:text-white transition-all active:scale-95 border border-slate-200/60 cursor-pointer"
            title="Voltar"
          >
            <ArrowLeft className="w-5 h-5 transition-transform group-hover:-translate-x-0.5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-100">
                /Art/Historico
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
              Histórico de Artes da Prefeitura
            </h1>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('/Art/Criar')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider shadow-md shadow-indigo-500/20 active:scale-95 transition-all cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Criar Nova Arte</span>
        </button>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Barra de Filtros e Busca */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Pesquisar por título, assunto ou categoria..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-50 pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 outline-none text-xs font-medium focus:bg-white focus:border-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none"
              >
                <option value="all">Todas as Categorias</option>
                {allCategories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <span className="text-xs font-bold text-slate-400 px-2">
                {filtered.length} {filtered.length === 1 ? 'publicação' : 'publicações'}
              </span>
            </div>
          </div>

          {/* Grid de Publicações Salvas */}
          {filtered.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map((pub) => {
                const selVar = pub.variations?.[pub.selectedVariationIndex || 0] || pub.variations?.[0];
                const primaryImg = pub.userImages?.[pub.primaryImageIndex || 0];

                return (
                  <div
                    key={pub.id}
                    onClick={() => onSelectPublication(pub.id)}
                    className="bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
                  >
                    {/* Visualizador de Miniatura */}
                    <div 
                      className="h-44 w-full relative overflow-hidden flex items-center justify-center p-4 text-center"
                      style={{
                        background: selVar?.gradientBackground || selVar?.backgroundColor || '#0f172a'
                      }}
                    >
                      {primaryImg && (
                        <img
                          src={primaryImg}
                          alt={pub.title}
                          className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:scale-105 transition-transform duration-500"
                        />
                      )}

                      <div className="relative z-10 p-3 max-w-full">
                        <span 
                          className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border shadow-sm backdrop-blur-md inline-block mb-2"
                          style={{
                            color: selVar?.accentColor || '#f59e0b',
                            background: 'rgba(255,255,255,0.1)',
                            borderColor: 'rgba(255,255,255,0.2)'
                          }}
                        >
                          {pub.category || 'Institucional'}
                        </span>
                        <h4 className="text-base font-black text-white line-clamp-2 drop-shadow-md">
                          {pub.title}
                        </h4>
                      </div>
                    </div>

                    {/* Informações da Publicação */}
                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold">
                          <span>{new Date(pub.createdAt).toLocaleDateString('pt-BR')}</span>
                          <span>{pub.variations?.length || 0} variações</span>
                        </div>

                        {pub.eventDate && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                            <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                            <span>{pub.eventDate}</span>
                          </div>
                        )}
                      </div>

                      {/* Ações da Publicação */}
                      <div className="flex items-center justify-between pt-4 mt-4 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onSelectPublication(pub.id); }}
                          className="flex items-center gap-1.5 text-xs font-black text-indigo-600 hover:text-indigo-800"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>Abrir Editor</span>
                        </button>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => handleDuplicate(pub.id, e)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
                            title="Duplicar publicação"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDelete(pub.id, pub.title, e)}
                            className="p-1.5 text-rose-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                            title="Excluir publicação"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-12 text-center bg-white rounded-3xl border border-slate-200/90 space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
                <Sparkles className="w-7 h-7" />
              </div>
              <h3 className="text-base font-black text-slate-900">
                Nenhuma publicação encontrada
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Crie sua primeira arte institucional utilizando o poder da IA generativa e suas imagens de referência.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('/Art/Criar')}
                className="px-5 py-2.5 rounded-2xl bg-indigo-600 text-white text-xs font-black uppercase tracking-wider shadow-md shadow-indigo-500/20 cursor-pointer"
              >
                Iniciar Criação
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
