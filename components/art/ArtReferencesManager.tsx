import React, { useState, useEffect, useRef } from 'react';
import { 
  ArrowLeft, Upload, Trash2, RefreshCw, Eye, Sparkles, Layers,
  ChevronLeft, ChevronRight, CheckCircle2, Image as ImageIcon, AlertCircle,
  X, Move, ArrowUpDown, Loader2
} from 'lucide-react';
import { ArtReferenceItem } from '../../types';
import { artStudioService, readFileAsOptimizedDataUrl } from '../../services/artStudioService';

interface ArtReferencesManagerProps {
  onBack: () => void;
  onNavigate?: (route: string) => void;
}

export const ArtReferencesManager: React.FC<ArtReferencesManagerProps> = ({ onBack, onNavigate }) => {
  const [references, setReferences] = useState<ArtReferenceItem[]>([]);
  const [activeSlotForUpload, setActiveSlotForUpload] = useState<number | null>(null);
  const [previewItem, setPreviewItem] = useState<ArtReferenceItem | null>(null);
  const [isUpdatingAI, setIsUpdatingAI] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [aiUpdatedSuccess, setAiUpdatedSuccess] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  const loadReferences = async () => {
    // 1. Carrega sincronamente o cache se disponível para exibição instantânea
    const cached = artStudioService.getReferences();
    if (cached && cached.length > 0) {
      setReferences(cached);
    }

    // 2. Hidrata do banco persistente IndexedDB
    try {
      const fromDb = await artStudioService.loadReferencesAsync();
      if (fromDb && fromDb.length > 0) {
        setReferences(fromDb);
      }
    } catch (err) {
      console.warn('Falha ao carregar referências do IndexedDB:', err);
    }
  };

  useEffect(() => {
    loadReferences();
  }, []);

  // Upload para slot individual ou troca (otimiza para qualidade visual e durabilidade no IndexedDB)
  const handleSingleSlotUpload = (slotIndex: number) => {
    setActiveSlotForUpload(slotIndex);
    fileInputRef.current?.click();
  };

  const onFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || activeSlotForUpload === null) return;

    setIsProcessing(true);
    try {
      const optimizedDataUrl = await readFileAsOptimizedDataUrl(file, 1000, 0.80);
      const updated = await artStudioService.setReferenceAtSlotAsync(
        activeSlotForUpload,
        file.name.replace(/\.[^/.]+$/, ''),
        optimizedDataUrl
      );
      setReferences(updated);
      setActiveSlotForUpload(null);
    } catch (err) {
      console.error('Erro ao processar imagem de referência:', err);
      alert('Erro ao carregar imagem. Tente outro arquivo.');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Upload em lote (preenche ordenadamente os slots disponíveis até o limite de 9)
  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files).slice(0, 9);
    setIsProcessing(true);

    try {
      const currentRefs = [...references];
      const itemsToSet: Array<{ slot: number; name: string; dataUrl: string }> = [];

      // Encontra slots livres de 0 a 8
      const usedSlots = new Set(currentRefs.map(r => r.index));
      const freeSlots: number[] = [];
      for (let s = 0; s < 9; s++) {
        if (!usedSlots.has(s)) {
          freeSlots.push(s);
        }
      }

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        let targetSlot: number;

        if (freeSlots.length > 0) {
          targetSlot = freeSlots.shift()!;
        } else {
          // Se todos os 9 slots já estavam ocupados, substitui ordenadamente
          targetSlot = i % 9;
        }

        const optimizedDataUrl = await readFileAsOptimizedDataUrl(file, 1000, 0.80);
        itemsToSet.push({
          slot: targetSlot,
          name: file.name.replace(/\.[^/.]+$/, ''),
          dataUrl: optimizedDataUrl
        });
      }

      const updated = await artStudioService.setMultipleReferencesAsync(itemsToSet);
      setReferences(updated);
    } catch (err) {
      console.error('Erro no upload em lote de referências:', err);
      alert('Houve uma falha ao processar as referências.');
    } finally {
      setIsProcessing(false);
      if (bulkFileInputRef.current) bulkFileInputRef.current.value = '';
    }
  };

  const handleRemove = async (slotIndex: number) => {
    setIsProcessing(true);
    try {
      const updated = await artStudioService.removeReferenceAtSlotAsync(slotIndex);
      setReferences(updated);
    } catch (err) {
      console.error('Erro ao remover referência:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMove = async (fromSlot: number, toSlot: number) => {
    if (toSlot < 0 || toSlot > 8) return;
    try {
      const updated = await artStudioService.reorderReferencesAsync(fromSlot, toSlot);
      setReferences(updated);
    } catch (err) {
      console.error('Erro ao mover prioridade:', err);
    }
  };

  const handleClearAll = async () => {
    if (confirm('Deseja realmente remover todas as referências visuais cadastradas?')) {
      setIsProcessing(true);
      try {
        await artStudioService.clearAllReferencesAsync();
        setReferences([]);
      } catch (err) {
        console.error('Erro ao limpar referências:', err);
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleSyncAI = async () => {
    setIsUpdatingAI(true);
    try {
      // Garante que o estado em tela está 100% persistido no IndexedDB
      await artStudioService.saveReferencesAsync(references);
      setTimeout(() => {
        setIsUpdatingAI(false);
        setAiUpdatedSuccess(true);
        setTimeout(() => setAiUpdatedSuccess(false), 3500);
      }, 500);
    } catch (err) {
      console.error('Erro ao sincronizar referências:', err);
      setIsUpdatingAI(false);
    }
  };

  // Renderiza 9 slots estritos
  const slots = Array.from({ length: 9 }, (_, i) => i);

  return (
    <div className="flex flex-col h-full bg-[#f8fafc] w-full overflow-hidden font-sans">
      {/* Barra de Navegação Superior com ROTA URL /Art/Referencias */}
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
                /Art/Referencias
              </span>
            </div>
            <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight mt-0.5">
              Imagens de Referência Visual
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <input
            type="file"
            ref={bulkFileInputRef}
            onChange={handleBulkUpload}
            multiple
            accept="image/*"
            className="hidden"
          />
          <input
            type="file"
            ref={fileInputRef}
            onChange={onFileInputChange}
            accept="image/*"
            className="hidden"
          />

          {references.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              className="px-3 py-2 rounded-2xl bg-white border border-slate-200 text-slate-500 hover:text-rose-600 hover:bg-rose-50 text-xs font-bold transition-all cursor-pointer"
            >
              Limpar Todas
            </button>
          )}

          <button
            type="button"
            disabled={isProcessing}
            onClick={() => bulkFileInputRef.current?.click()}
            className="px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 disabled:opacity-60"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            <span>{isProcessing ? 'Processando Imagens...' : 'Adicionar Várias (até 9)'}</span>
          </button>

          <button
            type="button"
            onClick={handleSyncAI}
            disabled={isUpdatingAI}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-md cursor-pointer ${
              aiUpdatedSuccess
                ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-500/20'
            }`}
          >
            {isUpdatingAI ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : aiUpdatedSuccess ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>{aiUpdatedSuccess ? 'Referências Atualizadas!' : 'Atualizar Referências da IA'}</span>
          </button>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Banner de Direção Artística */}
          <div className="bg-gradient-to-r from-indigo-50/90 via-sky-50/70 to-slate-50 p-5 rounded-3xl border border-indigo-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-2xl bg-indigo-600 text-white shrink-0 shadow-md shadow-indigo-500/20">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-sm md:text-base tracking-tight">
                  Diretrizes de Direção Artística para a IA
                </h3>
                <p className="text-slate-600 text-xs mt-0.5 leading-relaxed">
                  Envie até <strong>9 imagens de referência</strong>. A IA analisará a composição, hierarquia, paleta de cores e tipografia dessas referências para gerar novas criações originais com padrão institucional moderno. A ordem dos slots define a prioridade visual.
                </p>
              </div>
            </div>

            <div className="shrink-0 px-3.5 py-2 rounded-2xl bg-white border border-indigo-100 text-indigo-900 font-bold text-xs flex items-center gap-2 shadow-2xs self-end md:self-auto">
              <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
              <span>{references.length} de 9 referências ativas</span>
            </div>
          </div>

          {/* Grade Visual com exatamente 9 Slots */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {slots.map((slotIndex) => {
              const refItem = references.find(r => r.index === slotIndex);
              const slotNumberStr = String(slotIndex + 1).padStart(2, '0');

              return (
                <div
                  key={slotIndex}
                  className={`bg-white rounded-3xl border transition-all duration-300 overflow-hidden shadow-xs hover:shadow-md flex flex-col justify-between ${
                    refItem ? 'border-indigo-200/90' : 'border-dashed border-slate-300 bg-slate-50/50'
                  }`}
                >
                  {/* Cabeçalho do Slot com Prioridade */}
                  <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-800 text-[11px] font-black flex items-center justify-center">
                        {slotNumberStr}
                      </span>
                      <span className="text-xs font-bold text-slate-700">
                        Referência {slotNumberStr}
                      </span>
                    </div>

                    {refItem && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={slotIndex === 0}
                          onClick={() => handleMove(slotIndex, slotIndex - 1)}
                          className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-30 transition-colors cursor-pointer"
                          title="Mover para prioridade anterior"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={slotIndex === 8}
                          onClick={() => handleMove(slotIndex, slotIndex + 1)}
                          className="p-1 text-slate-400 hover:text-indigo-600 disabled:opacity-30 transition-colors cursor-pointer"
                          title="Mover para próxima prioridade"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Corpo do Slot: Imagem ou Espaço Vazio de Upload */}
                  {refItem ? (
                    <div className="p-4 flex flex-col justify-between flex-1">
                      <div 
                        onClick={() => setPreviewItem(refItem)}
                        className="h-44 w-full rounded-2xl overflow-hidden bg-slate-900/5 relative group cursor-pointer border border-slate-100"
                      >
                        <img
                          src={refItem.dataUrl}
                          alt={refItem.name}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                          <span className="p-2 rounded-xl bg-white text-slate-900 shadow-md">
                            <Eye className="w-4 h-4" />
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className="text-xs font-black text-slate-800 truncate" title={refItem.name}>
                          {refItem.name}
                        </span>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleSingleSlotUpload(slotIndex)}
                            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 text-xs font-bold transition-all cursor-pointer"
                          >
                            Trocar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemove(slotIndex)}
                            className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                            title="Remover referência deste slot"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div 
                      onClick={() => handleSingleSlotUpload(slotIndex)}
                      className="p-6 h-52 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-indigo-50/40 transition-colors group"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-400 group-hover:text-indigo-600 group-hover:border-indigo-200 group-hover:scale-110 transition-all mb-2">
                        <Upload className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-black text-slate-700 group-hover:text-indigo-600">
                        Adicionar Imagem
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5">
                        Slot {slotNumberStr} disponível
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Modal de Pré-visualização de Imagem */}
      {previewItem && (
        <div 
          onClick={() => setPreviewItem(null)}
          className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl overflow-hidden max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200"
          >
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <span className="text-sm font-black text-slate-900">{previewItem.name}</span>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-auto flex items-center justify-center bg-slate-950 max-h-[70vh]">
              <img
                src={previewItem.dataUrl}
                alt={previewItem.name}
                className="max-h-[65vh] max-w-full object-contain rounded-xl"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
